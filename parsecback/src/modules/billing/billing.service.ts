// src\modules\billing\billing.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { TariffsService } from '@/modules/tariffs/tariffs.service';
import {
  BillingTransaction,
  type BillingKind,
  type BillingSource,
} from './entities/billing-transaction.entity';
import { Tariff } from '@/modules/tariffs/entities/tariff.entity';
import { UserTariff } from '@/modules/tariffs/entities/user-tariff.entity';
import { User } from '@/modules/users/entities/user.entity';
import { addStr, subStr, mulStr, absStr, gteStr } from './utils/money';
import type { PrecheckResult } from './types';
import type { ServiceCode } from '@/modules/tariffs/tariff.constants';
import { UsersService } from '../users/users.service';
import {
  BillingReportGroup,
  PartnerReportParams,
  PartnerBillingReport,
  PartnerBillingReportRow,
  AdminReportParams,
  AdminBillingReport,
  AdminBillingReportRow,
  MonthSummary,
} from './types/billing-report.types';

/** type-guard: от User нужен только balance (string). */
function readUserBalance(u: unknown): string {
  if (
    u &&
    typeof u === 'object' &&
    'balance' in (u as Record<string, unknown>)
  ) {
    const v = (u as { balance?: unknown }).balance;
    if (typeof v === 'string') return v;
  }
  throw new BadRequestException('user_balance_invalid');
}

/**
 * Биллинг со строгой целостностью:
 * - pg_advisory_xact_lock(userId) — одна операция на пользователя за раз (во всей БД)
 * - SELECT ... FOR UPDATE — блокировки строк User/UserTariff/Tx внутри транзакции
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly ds: DataSource,
    private readonly users: UsersService,
    private readonly tariffs: TariffsService,
  ) {}

  /** Выполнить работу под транзакционной advisory-блокировкой пользователя */
  private async inUserLock<T>(
    userId: number,
    work: (trx: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.ds.transaction(async (trx) => {
      await trx.query('SELECT pg_advisory_xact_lock($1)', [userId]);
      return work(trx);
    });
  }

  /**
   * Пред-чек оплаты:
   * 1) пробуем активный тариф → если хватает;
   * 2) иначе — общий баланс по цене тарифа NONE;
   */
  async precheckFunds(
    userId: number,
    service: ServiceCode,
    quantity = 1,
  ): Promise<PrecheckResult> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, reason: 'no_price', detail: { msg: 'bad_quantity' } };
    }

    // 1) активный тариф
    const ut = await this.tariffs.getActiveUserTariff(userId).catch(() => null);
    if (ut) {
      const unitTariff = await this.tariffs.getPrice(ut.tariffId, service);
      if (BigInt(unitTariff) === 0n) {
        return {
          ok: true,
          payer: 'TARIFF',
          userTariffId: ut.id,
          unitPrice: unitTariff,
          quantity,
          total: '0',
        };
      }
      const need = mulStr(unitTariff, quantity);
      if (gteStr(ut.balance, need)) {
        return {
          ok: true,
          payer: 'TARIFF',
          userTariffId: ut.id,
          unitPrice: unitTariff,
          quantity,
          total: need,
        };
      }
      // не хватило — попробуем NONE
    }

    // 2) общий баланс по тарифу NONE
    let priceNone: string | null = null;
    try {
      priceNone = await this.tariffs.getPriceByTariffCode('NONE', service);
    } catch {
      priceNone = null;
    }
    if (!priceNone) return { ok: false, reason: 'no_price' };

    const userRaw = await this.users.getUserById(userId); // тип User, но подстрахуемся
    const userBalance = readUserBalance(userRaw);
    const needNone = mulStr(priceNone, quantity);

    if (gteStr(userBalance, needNone)) {
      return {
        ok: true,
        payer: 'USER_BALANCE',
        userTariffId: null,
        unitPrice: priceNone,
        quantity,
        total: needNone,
      };
    }

    return {
      ok: false,
      reason: 'insufficient_funds',
      detail: {
        userBalance,
        needNone,
        hasActiveTariff: Boolean(ut),
      },
    };
  }

  /**
   * Реальное списание (часть — с активного тарифа, остаток — с общего баланса по NONE).
   * Всё в одной транзакции и под локами.
   */
  async charge(
    userId: number,
    service: ServiceCode,
    quantity: number,
    description: string,
    softId?: string | null,
  ): Promise<void> {
    if (quantity <= 0)
      throw new BadRequestException('quantity_must_be_positive');

    await this.inUserLock(userId, async (trx) => {
      const txRepo = trx.getRepository(BillingTransaction);
      const utRepo = trx.getRepository(UserTariff);
      const userRepo = trx.getRepository(User);
      const tariffRepo = trx.getRepository(Tariff);

      // Лочим пользователя (общий баланс)
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('user_not_found');

      // Активный пользовательский тариф (под локом)
      const nowIso = new Date().toISOString();
      const activeTariff = await utRepo
        .createQueryBuilder('ut')
        .where('ut.userId = :userId', { userId })
        .andWhere('ut.status = :st', { st: 'ACTIVE' })
        .andWhere('ut.startsAt <= :now AND ut.expiresAt > :now', {
          now: nowIso,
        })
        .orderBy('ut.expiresAt', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      // Базовый тариф NONE
      const baseTariff = await tariffRepo.findOne({
        where: { code: 'NONE', isActive: true },
      });
      if (!baseTariff) throw new NotFoundException('base_tariff_not_found');

      let remaining = quantity;

      // 1) списание с активного тарифа
      if (activeTariff && BigInt(activeTariff.balance) > 0n) {
        const unit = await this.tariffs.getPrice(
          activeTariff.tariffId,
          service,
        );
        if (BigInt(unit) <= 0n) {
          throw new BadRequestException('invalid_tariff_unit_price');
        }

        const maxUnitsByMoney = Number(
          BigInt(activeTariff.balance) / BigInt(unit),
        ); // floor
        const useUnits = Math.min(remaining, Math.max(0, maxUnitsByMoney));

        if (useUnits > 0) {
          const cost = mulStr(unit, useUnits);
          activeTariff.balance = subStr(activeTariff.balance, cost);
          await utRepo.save(activeTariff);

          const t = txRepo.create({
            userId,
            userTariffId: activeTariff.id,
            kind: 'DEBIT',
            source: 'USER_TARIFF',
            service,
            quantity: useUnits,
            unitPrice: unit,
            amount: `-${cost}`,
            description,
            softId: softId ?? null,
            meta: { part: 'tariff' },
            state: 'POSTED',
            refundOfTxId: null,
          });
          await txRepo.save(t);

          remaining -= useUnits;
        }
      }

      // 2) остаток — с общего баланса по цене NONE
      if (remaining > 0) {
        const unit = await this.tariffs.getPrice(baseTariff.id, service);
        if (BigInt(unit) < 0n) {
          throw new BadRequestException('invalid_base_unit_price');
        }

        const cost = mulStr(unit, remaining);
        if (!gteStr(user.balance, cost)) {
          throw new BadRequestException('insufficient_user_balance');
        }
        user.balance = subStr(user.balance, cost);
        await userRepo.save(user);

        const t = txRepo.create({
          userId,
          userTariffId: null,
          kind: 'DEBIT',
          source: 'USER_BALANCE',
          service,
          quantity: remaining,
          unitPrice: unit,
          amount: `-${cost}`,
          description,
          softId: softId ?? null,
          meta: { part: 'base' },
          state: 'POSTED',
          refundOfTxId: null,
        });
        await txRepo.save(t);
      }
    });
  }

  /** Пополнение общего баланса пользователя (источник — внешний платёж) */
  async topUpUserBalance(params: {
    userId: number;
    amount: string; // тысячные рубля, > 0
    description: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const { userId, amount, description, meta } = params;
    if (BigInt(amount) <= 0n) {
      throw new BadRequestException('topup_must_be_positive');
    }

    await this.inUserLock(userId, async (trx) => {
      const userRepo = trx.getRepository(User);
      const txRepo = trx.getRepository(BillingTransaction);

      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('user_not_found');

      user.balance = addStr(user.balance, amount);
      await userRepo.save(user);

      const credit = txRepo.create({
        userId,
        userTariffId: null,
        kind: 'CREDIT',
        source: 'USER_BALANCE',
        service: null,
        quantity: 0,
        unitPrice: '0',
        amount,
        description,
        meta: meta ?? null,
        state: 'POSTED',
        refundOfTxId: null,
      });
      await txRepo.save(credit);
    });
  }

  /**
   * Рефанд исходной транзакции (частичный или полный) c опциональной компенсацией.
   * - блокируем исходную транзакцию (FOR UPDATE),
   * - меняем баланс источника (user/userTariff) под локом,
   * - создаём обратную проводку, помечаем оригинал как REFUNDED.
   */
  async refundTransaction(params: {
    userId: number;
    originalTxId: number;
    amount?: string; // если пусто — полный рефанд abs(original.amount)
    compensationExtra?: string; // доп. компенсация (знак следует за рефандом)
    description?: string;
  }): Promise<void> {
    const { userId, originalTxId, amount, compensationExtra, description } =
      params;

    await this.inUserLock(userId, async (trx) => {
      const txRepo = trx.getRepository(BillingTransaction);
      const utRepo = trx.getRepository(UserTariff);
      const userRepo = trx.getRepository(User);

      const original = await txRepo.findOne({
        where: { id: originalTxId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!original) throw new NotFoundException('transaction_not_found');
      if (original.state === 'REFUNDED') {
        throw new BadRequestException('transaction_already_refunded');
      }

      const full = absStr(original.amount);
      const req = amount ?? full;
      if (BigInt(req) <= 0n) {
        throw new BadRequestException('refund_amount_must_be_positive');
      }
      if (BigInt(req) > BigInt(full)) {
        throw new BadRequestException('refund_amount_exceeds_original');
      }

      const extra = compensationExtra ? BigInt(compensationExtra) : 0n;
      const isOriginalDebit = original.kind === 'DEBIT';
      const refundKind: BillingKind = isOriginalDebit ? 'CREDIT' : 'DEBIT';

      // сумма с правильным знаком: для DEBIT делаем +, для CREDIT делаем -
      let refundAmount = BigInt(req);
      if (!isOriginalDebit) refundAmount = -refundAmount;
      refundAmount += extra;

      // корректируем балансы источника под локами строк
      if (original.source === 'USER_BALANCE') {
        const user = await userRepo.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('user_not_found');

        const newBalance = addStr(user.balance, refundAmount.toString());
        if (BigInt(newBalance) < 0n) {
          throw new BadRequestException('insufficient_user_balance_for_refund');
        }
        user.balance = newBalance;
        await userRepo.save(user);
      } else if (original.source === 'USER_TARIFF') {
        if (!original.userTariffId) {
          throw new BadRequestException('original_tariff_missing');
        }
        const ut = await utRepo.findOne({
          where: { id: original.userTariffId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!ut) throw new NotFoundException('user_tariff_not_found');

        const newTariffBalance = addStr(ut.balance, refundAmount.toString());
        if (BigInt(newTariffBalance) < 0n) {
          throw new BadRequestException(
            'insufficient_tariff_balance_for_refund',
          );
        }
        ut.balance = newTariffBalance;
        await utRepo.save(ut);
      }

      // проводка-рефанд
      const refundTx = txRepo.create({
        userId,
        userTariffId: original.userTariffId,
        kind: refundKind,
        source: original.source,
        service: original.service,
        quantity: 0,
        unitPrice: '0',
        amount: refundAmount.toString(),
        description:
          description ??
          (isOriginalDebit
            ? `Refund of debit tx #${original.id}`
            : `Reversal of credit tx #${original.id}`),
        meta: {
          refundOf: original.id,
          requested: req,
          extra: extra.toString(),
        },
        state: 'POSTED',
        refundOfTxId: original.id,
      });
      await txRepo.save(refundTx);

      // помечаем оригинал
      original.state = 'REFUNDED';
      await txRepo.save(original);
    });
  }

  /** История транзакций (пополнения/списания/рефанды) */
  async listTransactions(params: {
    userId: number;
    kinds?: BillingKind[];
    sources?: BillingSource[];
    limit?: number;
    beforeId?: number;
  }): Promise<BillingTransaction[]> {
    const { userId, kinds, sources, limit = 50, beforeId } = params;

    const qb = this.ds
      .getRepository(BillingTransaction)
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId });

    if (kinds && kinds.length > 0)
      qb.andWhere('t.kind IN (:...kinds)', { kinds });
    if (sources && sources.length > 0)
      qb.andWhere('t.source IN (:...sources)', { sources });
    if (beforeId) qb.andWhere('t.id < :beforeId', { beforeId });

    return qb
      .orderBy('t.id', 'DESC')
      .limit(Math.max(1, Math.min(200, limit)))
      .getMany();
  }

  private getSafeTimezone(tz?: string | null): string {
    if (!tz || typeof tz !== 'string' || !tz.trim()) {
      return 'Europe/Moscow';
    }
    return tz;
  }

  /**
   * Формирует ключ даты с учётом таймзоны.
   * group = 'day'  → "YYYY-MM-DD"
   * group = 'month'→ "YYYY-MM"
   */
  private makeDateKey(
    date: Date,
    group: BillingReportGroup,
    timezone: string,
  ): string {
    const optsDay: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const optsMonth: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    };

    const fmt = new Intl.DateTimeFormat(
      'en-CA', // даёт "YYYY-MM-DD"
      group === 'day' ? optsDay : optsMonth,
    );
    const s = fmt.format(date); // "YYYY-MM-DD" или "YYYY-MM"
    if (group === 'month' && s.length >= 7) {
      return s.slice(0, 7); // "YYYY-MM"
    }
    return s;
  }

  private addAmountStr(a: string, b: string): string {
    // обе строки — неотрицательные "целые" в тысячных
    return addStr(a, b);
  }

  private absAmountStr(x: string): string {
    return absStr(x);
  }

  /** Отчёт для конкретного softId (партнёр). */
  async getPartnerSoftReport(
    params: PartnerReportParams,
  ): Promise<PartnerBillingReport> {
    const {
      softId,
      group,
      dateFrom,
      dateTo,
      services,
      timezone,
      limit,
      offset,
    } = params;

    const tz = this.getSafeTimezone(timezone);

    const groupExpr =
      group === 'month'
        ? `to_char(t."createdAt" AT TIME ZONE '${tz}', 'YYYY-MM')`
        : `to_char(t."createdAt" AT TIME ZONE '${tz}', 'YYYY-MM-DD')`;

    const qb = this.ds
      .getRepository(BillingTransaction)
      .createQueryBuilder('t')
      .select([
        `${groupExpr} AS bucket`,
        'SUM(t.quantity)::int AS requests',
        'SUM(ABS(t.amount))::bigint AS amount',
        't.service AS service',
      ])
      .where('t.softId = :softId', { softId })
      .andWhere('t.kind = :kind', { kind: 'DEBIT' })
      .andWhere('t.state = :state', { state: 'POSTED' });

    if (dateFrom) qb.andWhere('t."createdAt" >= :from', { from: dateFrom });
    if (dateTo) qb.andWhere('t."createdAt" <= :to', { to: dateTo });

    if (services?.length) {
      qb.andWhere('t.service IN (:...services)', { services });
    }

    qb.groupBy('bucket, t.service')
      .orderBy('bucket', 'ASC')
      .limit(limit)
      .offset(offset);

    const rowsRaw = await qb.getRawMany<{
      bucket: string;
      requests: number;
      amount: string;
      service: ServiceCode | null;
    }>();

    // агрегация по bucket
    const map = new Map<string, PartnerBillingReportRow>();
    const summaryByService: Record<
      string,
      { requests: number; amount: string }
    > = {};

    let totalRequests = 0;
    let totalAmount = '0';

    for (const r of rowsRaw) {
      const row = map.get(r.bucket) ?? {
        date: r.bucket,
        requests: 0,
        amount: '0',
      };

      row.requests += r.requests;
      row.amount = this.addAmountStr(row.amount, r.amount);

      map.set(r.bucket, row);

      totalRequests += r.requests;
      totalAmount = this.addAmountStr(totalAmount, r.amount);

      if (r.service) {
        const svc = summaryByService[r.service] ?? { requests: 0, amount: '0' };
        svc.requests += r.requests;
        svc.amount = this.addAmountStr(svc.amount, r.amount);
        summaryByService[r.service] = svc;
      }
    }

    const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

    return {
      softId,
      group,
      rows,
      summary: {
        totalRequests,
        totalAmount,
        byService: summaryByService,
      },
    };
  }

  /** Отчёт для админа: по всем softId или по одному. */
  async getAdminSoftReport(
    params: AdminReportParams,
  ): Promise<AdminBillingReport> {
    const {
      group,
      dateFrom,
      dateTo,
      services,
      timezone,
      limit,
      offset,
      softId,
    } = params;

    const tz = this.getSafeTimezone(timezone);
    const txRepo = this.ds.getRepository(BillingTransaction);
    const userRepo = this.ds.getRepository(User);

    // -------------------------------
    // 0) Получаем softId из транзакций
    // -------------------------------
    const softIdQb = txRepo
      .createQueryBuilder('t')
      .select('DISTINCT t."softId"', 'softId')
      .where('t."softId" IS NOT NULL')
      .andWhere(`t."softId" <> ''`);

    if (softId) {
      softIdQb.andWhere('t."softId" = :softId', { softId });
    }

    const softIdRows = await softIdQb.getRawMany<{ softId: string }>();

    const softIds = softIdRows.map((r) => r.softId);

    if (softId && !softIds.includes(softId)) {
      return {
        group,
        rows: [],
        summary: {
          totalRequests: 0,
          totalAmount: '0',
          byService: {},
          currentMonth: undefined,
          previousMonth: undefined,
        },
      };
    }

    if (softIds.length === 0) {
      return {
        group,
        rows: [],
        summary: {
          totalRequests: 0,
          totalAmount: '0',
          byService: {},
          currentMonth: undefined,
          previousMonth: undefined,
        },
      };
    }

    // -------------------------------
    // 1) Загружаем владельцев softId
    // -------------------------------
    const ownersRaw = await userRepo.find({
      where: { softId: In(softIds) },
      select: ['id', 'email', 'softId'],
    });

    const owners = ownersRaw.map((o) => ({
      id: o.id,
      email: o.email,
      softId: o.softId!,
    }));

    const ownerMap = new Map<
      string,
      { id: number; email: string; softId: string }
    >();
    for (const o of owners) {
      ownerMap.set(o.softId, o);
    }

    // -------------------------------
    // 2) SQL-агрегация
    // -------------------------------
    const groupExpr =
      group === 'month'
        ? `to_char(t."createdAt" AT TIME ZONE '${tz}', 'YYYY-MM')`
        : `to_char(t."createdAt" AT TIME ZONE '${tz}', 'YYYY-MM-DD')`;

    const qb = txRepo
      .createQueryBuilder('t')
      .select([
        `${groupExpr} AS bucket`,
        `t."softId" AS "softId"`,
        't."service" AS "service"',
        'SUM(t.quantity)::int AS "requests"',
        'SUM(ABS(t.amount))::bigint AS "amount"',
        `to_char(t."createdAt" AT TIME ZONE '${tz}', 'YYYY-MM') AS "monthBucket"`,
      ])
      .where('t.kind = :kind', { kind: 'DEBIT' })
      .andWhere('t.state = :state', { state: 'POSTED' })
      .andWhere('t."softId" IN (:...softIds)', { softIds });

    if (dateFrom) qb.andWhere('t."createdAt" >= :from', { from: dateFrom });
    if (dateTo) qb.andWhere('t."createdAt" <= :to', { to: dateTo });
    if (services?.length)
      qb.andWhere('t."service" IN (:...services)', { services });

    qb.groupBy(`bucket, "softId", t."service", "monthBucket"`)
      .orderBy(`"softId"`, 'ASC')
      .addOrderBy('bucket', 'ASC')
      .limit(limit)
      .offset(offset);

    const rowsRaw = await qb.getRawMany<{
      bucket: string;
      softId: string;
      service: ServiceCode | null;
      requests: number;
      amount: string;
      monthBucket: string;
    }>();

    const rowsMap = new Map<string, AdminBillingReportRow>();
    const monthMap = new Map<string, MonthSummary>();
    const globalByService: Record<
      string,
      { requests: number; amount: string }
    > = {};

    let totalRequests = 0;
    let totalAmount = '0';

    for (const r of rowsRaw) {
      const owner = ownerMap.get(r.softId);

      const key = `${r.softId}|${r.bucket}`;

      const row = rowsMap.get(key) ?? {
        softId: r.softId,
        userId: owner?.id ?? 0,
        email: owner?.email ?? '',
        date: r.bucket,
        totalRequests: 0,
        totalAmount: '0',
        services: {},
      };

      row.totalRequests += r.requests;
      row.totalAmount = this.addAmountStr(row.totalAmount, r.amount);
      rowsMap.set(key, row);

      if (r.service) {
        const svc = row.services[r.service] ?? { requests: 0, amount: '0' };
        svc.requests += r.requests;
        svc.amount = this.addAmountStr(svc.amount, r.amount);
        row.services[r.service] = svc;

        const g = globalByService[r.service] ?? { requests: 0, amount: '0' };
        g.requests += r.requests;
        g.amount = this.addAmountStr(g.amount, r.amount);
        globalByService[r.service] = g;
      }

      totalRequests += r.requests;
      totalAmount = this.addAmountStr(totalAmount, r.amount);

      const m = monthMap.get(r.monthBucket) ?? {
        month: r.monthBucket,
        totalRequests: 0,
        totalAmount: '0',
        byService: {},
      };

      m.totalRequests += r.requests;
      m.totalAmount = this.addAmountStr(m.totalAmount, r.amount);

      if (r.service) {
        const ms = m.byService[r.service] ?? { requests: 0, amount: '0' };
        ms.requests += r.requests;
        ms.amount = this.addAmountStr(ms.amount, r.amount);
        m.byService[r.service] = ms;
      }

      monthMap.set(r.monthBucket, m);
    }

    const rows = [...rowsMap.values()].sort((a, b) => {
      if (a.softId === b.softId) return a.date.localeCompare(b.date);
      return a.softId.localeCompare(b.softId);
    });

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const previousDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const previousMonth = previousDate.toISOString().slice(0, 7);

    return {
      group,
      rows,
      summary: {
        totalRequests,
        totalAmount,
        byService: globalByService,
        currentMonth: monthMap.get(currentMonth) ?? undefined,
        previousMonth: monthMap.get(previousMonth) ?? undefined,
      },
    };
  }

  async getAllSoftIdsWithTransactions(): Promise<string[]> {
    const userRepo = this.ds.getRepository(User);

    const rows = await userRepo
      .createQueryBuilder('u')
      .select('u.softId', 'softId')
      .where('u.softId IS NOT NULL')
      .andWhere("u.softId <> ''")
      .orderBy('u.softId', 'ASC')
      .getRawMany<{ softId: string }>();

    return rows.map((r) => r.softId);
  }
}
