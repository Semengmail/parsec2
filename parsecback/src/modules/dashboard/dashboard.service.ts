import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TariffsService } from '@/modules/tariffs/tariffs.service';
import { Tariff } from '@/modules/tariffs/entities/tariff.entity';
import { UserTariff } from '@/modules/tariffs/entities/user-tariff.entity';
import { TariffRate } from '@/modules/tariffs/entities/tariff-rate.entity';
import { BillingTransaction } from '@/modules/billing/entities/billing-transaction.entity';
import type { DashboardSummary, SummaryRate } from './types';
import { UsersService } from '../users/users.service';

function divFloor(a: string, b: string): number {
  const bb = BigInt(b);
  if (bb <= 0n) return 0;
  return Number(BigInt(a) / bb);
}
function absStr(a: string): string {
  const n = BigInt(a);
  return (n < 0n ? -n : n).toString();
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly tariffs: TariffsService,
    private readonly users: UsersService,
    @InjectRepository(Tariff) private readonly tariffRepo: Repository<Tariff>,
    @InjectRepository(UserTariff)
    private readonly userTariffRepo: Repository<UserTariff>,
    @InjectRepository(TariffRate)
    private readonly rateRepo: Repository<TariffRate>,
    @InjectRepository(BillingTransaction)
    private readonly txRepo: Repository<BillingTransaction>,
  ) {}

  async summary(userId: number): Promise<DashboardSummary> {
    // ✅ достаём API-ключ
    const { apiKey } = await this.users.getProfileWithApiKey(userId);
    // активный пользовательский тариф
    const ut = await this.tariffs.getActiveUserTariff(userId); // UserTariff | null

    // базовый тариф (NONE)
    const base = await this.tariffRepo.findOne({
      where: { code: 'NONE', isActive: true },
    });

    // ставки активного тарифа (если есть)
    let rates: SummaryRate[] = [];
    if (ut) {
      const tariff = await this.tariffRepo.findOne({
        where: { id: ut.tariffId },
      });
      if (!tariff) throw new NotFoundException('tariff_not_found');
      const list = await this.rateRepo.find({ where: { tariffId: tariff.id } });
      rates = list.map((r) => ({
        service: r.service,
        unitPrice: r.unitPrice,
        availableByMoney: divFloor(ut.balance, r.unitPrice),
        limitUnits: r.limitUnits ?? null,
      }));
    }

    // траты (DEBIT, state=POSTED) → суммы как положительные
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400_000).toISOString();

    const rawLast7 = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(-t.amount), 0)', 'sum') // amount отрицательный → -amount положительный
      .where(
        't.userId = :userId AND t.kind = :k AND t.state = :s AND t.createdAt >= :since',
        {
          userId,
          k: 'DEBIT',
          s: 'POSTED',
          since: d7,
        },
      )
      .getRawOne<{ sum: string }>();

    const rawLast30 = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(-t.amount), 0)', 'sum')
      .where(
        't.userId = :userId AND t.kind = :k AND t.state = :s AND t.createdAt >= :since',
        {
          userId,
          k: 'DEBIT',
          s: 'POSTED',
          since: d30,
        },
      )
      .getRawOne<{ sum: string }>();

    const rawTotal = await this.txRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.kind = 'DEBIT' THEN -t.amount ELSE 0 END), 0)",
        'sum',
      )
      .where('t.userId = :userId AND t.state = :s', { userId, s: 'POSTED' })
      .getRawOne<{ sum: string }>();

    return {
      apiKey,
      tariff: ut
        ? {
            code:
              (await this.tariffRepo.findOne({ where: { id: ut.tariffId } }))
                ?.code ?? 'UNKNOWN',
            name:
              (await this.tariffRepo.findOne({ where: { id: ut.tariffId } }))
                ?.name ?? 'Тариф',
            balance: ut.balance,
            expiresAt: ut.expiresAt.toISOString(),
          }
        : null,
      baseTariff: base ? { code: base.code, name: base.name } : null,
      rates,
      spend: {
        last7d: absStr(rawLast7?.sum ?? '0'),
        last30d: absStr(rawLast30?.sum ?? '0'),
        total: absStr(rawTotal?.sum ?? '0'),
      },
    };
  }
}
