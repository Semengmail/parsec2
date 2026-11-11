// src/modules/services/services.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TariffsService } from '@/modules/tariffs/tariffs.service';
import { UserTariff } from '@/modules/tariffs/entities/user-tariff.entity';
import { Tariff } from '@/modules/tariffs/entities/tariff.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  ServiceSettings,
  type ServiceSettingsValue,
} from './entities/service-settings.entity';
import type { ServiceDescriptor } from './services.registry';
import { ServiceCode } from '../tariffs/tariff.constants';

type MoneyStr = string;

export type ServiceSummary = {
  spend: { today: MoneyStr; last7d: MoneyStr; last30d: MoneyStr };
  pricePerUnit: MoneyStr;
  tariff: {
    code: Tariff['code'];
    name: string;
    expiresAt: string | null;
    balance: MoneyStr;
  } | null;
  queriesLeft: number;
};

export type SeriesGroup = 'hour' | 'day' | 'month';
export type SeriesPoint = { at: string; amount: MoneyStr };

@Injectable()
export class ServicesService {
  constructor(
    private readonly ds: DataSource,
    private readonly tariffs: TariffsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---------- helpers (type-safe parsing of raw SQL) ----------

  /** Извлекаем скалярное поле из результата query */
  private pickScalar(rows: unknown, key: string, fallback = '0'): string {
    if (!Array.isArray(rows)) return fallback;
    const arr: readonly unknown[] = rows as readonly unknown[];
    if (arr.length === 0) return fallback;

    const first: unknown = arr[0];
    if (typeof first !== 'object' || first === null) return fallback;

    const v = (first as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    return fallback;
  }

  /** мапим строки { label, amt } в SeriesPoint[] */
  private mapSeriesRows(raw: unknown): SeriesPoint[] {
    if (!Array.isArray(raw)) return [];
    const arr: readonly unknown[] = raw as readonly unknown[];
    const out: SeriesPoint[] = [];

    for (const item of arr) {
      if (typeof item !== 'object' || item === null) continue;
      const rec = item as Record<string, unknown>;

      const label = rec['label'];
      const amt = rec['amt'];

      const at =
        typeof label === 'string'
          ? label
          : typeof label === 'number'
            ? String(label)
            : '';

      const amount =
        typeof amt === 'string'
          ? amt
          : typeof amt === 'number'
            ? String(amt)
            : '0';

      if (at) out.push({ at, amount });
    }

    return out;
  }

  // ---------- queries ----------

  private async sumSpent(
    userId: number,
    serviceCode: string,
    fromISO: string,
  ): Promise<MoneyStr> {
    const raw = (await this.ds.query(
      `
      SELECT COALESCE(SUM(ABS("amount")::bigint), 0)::bigint AS s
      FROM "billing_transactions"
      WHERE "userId" = $1
        AND "service" = $2
        AND "kind" = 'DEBIT'
        AND "state" = 'POSTED'
        AND "createdAt" >= $3
      `,
      [userId, serviceCode, fromISO],
    )) as unknown;

    return this.pickScalar(raw, 's', '0');
  }

  async summary(
    userId: number,
    svc: ServiceDescriptor,
  ): Promise<ServiceSummary> {
    const now = new Date();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const d7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    const [todayS, last7dS, last30dS] = await Promise.all([
      this.sumSpent(userId, svc.code, today),
      this.sumSpent(userId, svc.code, d7),
      this.sumSpent(userId, svc.code, d30),
    ]);

    const utRepo = this.ds.getRepository(UserTariff);
    const tariffRepo = this.ds.getRepository(Tariff);

    const ut = await utRepo
      .createQueryBuilder('ut')
      .where('ut.userId = :userId', { userId })
      .andWhere('ut.status = :st', { st: 'ACTIVE' })
      .andWhere('ut.startsAt <= :now AND ut.expiresAt > :now', {
        now: now.toISOString(),
      })
      .orderBy('ut.expiresAt', 'DESC')
      .getOne();

    const baseTariff = await tariffRepo.findOne({ where: { code: 'NONE' } });
    const priceTariffId = ut ? ut.tariffId : baseTariff?.id;

    if (!priceTariffId) {
      return {
        spend: { today: todayS, last7d: last7dS, last30d: last30dS },
        pricePerUnit: '0',
        tariff: null,
        queriesLeft: 0,
      };
    }

    const unitPrice = await this.tariffs.getPrice(priceTariffId, svc.code);

    let queriesLeft = 0;
    if (ut && BigInt(unitPrice) > 0n) {
      queriesLeft = Number(BigInt(ut.balance) / BigInt(unitPrice));
    }

    let tariffInfo: ServiceSummary['tariff'] = null;
    if (ut) {
      const t = await tariffRepo.findOne({ where: { id: ut.tariffId } });
      if (t) {
        tariffInfo = {
          code: t.code,
          name: t.name,
          expiresAt: ut.expiresAt?.toISOString() ?? null,
          balance: ut.balance,
        };
      }
    }

    return {
      spend: { today: todayS, last7d: last7dS, last30d: last30dS },
      pricePerUnit: unitPrice,
      tariff: tariffInfo,
      queriesLeft,
    };
  }

  async series(
    userId: number,
    svc: ServiceDescriptor,
    group: SeriesGroup,
    from: string,
    to: string,
  ): Promise<SeriesPoint[]> {
    const granule =
      group === 'hour' ? 'hour' : group === 'day' ? 'day' : 'month';

    const raw = (await this.ds.query(
      `
      SELECT to_char(date_trunc('${granule}', "createdAt"),
                    CASE '${granule}'
                      WHEN 'hour'  THEN 'YYYY-MM-DD"T"HH24:00'
                      WHEN 'day'   THEN 'YYYY-MM-DD'
                      ELSE              'YYYY-MM'
                    END) AS label,
             COALESCE(SUM(ABS("amount")::bigint), 0)::bigint AS amt
      FROM "billing_transactions"
      WHERE "userId" = $1
        AND "service" = $2
        AND "kind" = 'DEBIT'
        AND "state" = 'POSTED'
        AND "createdAt" BETWEEN $3 AND $4
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [userId, svc.code, from, to],
    )) as unknown;

    return this.mapSeriesRows(raw);
  }

  // ---------- settings ----------

  async getSettings(
    userId: number,
    svc: ServiceDescriptor,
  ): Promise<ServiceSettingsValue> {
    const repo = this.ds.getRepository(ServiceSettings);
    const found = await repo.findOne({ where: { userId, service: svc.code } });
    return found?.settings ?? {};
  }

  async saveSettings(
    userId: number,
    svc: ServiceDescriptor,
    settings: ServiceSettingsValue,
  ): Promise<void> {
    const repo = this.ds.getRepository(ServiceSettings);
    const found = await repo.findOne({ where: { userId, service: svc.code } });
    if (found) {
      found.settings = settings;
      await repo.save(found);
    } else {
      const e = repo.create({ userId, service: svc.code, settings });
      await repo.save(e);
    }
  }

  async getSettingsByCode(
    userId: number,
    serviceCode: ServiceCode,
  ): Promise<ServiceSettingsValue> {
    const cacheKey = `services:settings:${userId}:${serviceCode}`;

    // ✅ пробуем из кэша
    const cached = await this.cache.get<ServiceSettingsValue>(cacheKey);
    if (cached) return cached;

    const repo = this.ds.getRepository(ServiceSettings);
    const found = await repo.findOne({
      where: {
        userId,
        service: serviceCode,
      },
    });

    const settings = found?.settings ?? {};

    // ✅ кладём в кэш на 60 секунд
    await this.cache.set(cacheKey, settings, 60_000);

    return settings;
  }
}
