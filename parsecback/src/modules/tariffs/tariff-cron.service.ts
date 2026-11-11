// src/modules/tariffs/tariff-cron.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { UserTariff } from './entities/user-tariff.entity';
import { BillingTransaction } from '../billing/entities/billing-transaction.entity';

@Injectable()
export class TariffCronService {
  constructor(
    @InjectRepository(UserTariff)
    private readonly userTariffRepo: Repository<UserTariff>,
    @InjectRepository(BillingTransaction)
    private readonly txRepo: Repository<BillingTransaction>,
    private readonly ds: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireTariffs(): Promise<void> {
    const now = new Date();
    const toExpire = await this.userTariffRepo
      .createQueryBuilder('ut')
      .where('ut.status = :st', { st: 'ACTIVE' })
      .andWhere('ut.expiresAt <= :now', { now: now.toISOString() })
      .getMany();

    if (toExpire.length === 0) return;

    await this.ds.transaction(async (trx: EntityManager) => {
      const txRepo = trx.getRepository(BillingTransaction);
      const utRepo = trx.getRepository(UserTariff);

      for (const ut of toExpire) {
        // списываем остаток в леджер как отдельную операцию (для прозрачности)
        if (BigInt(ut.balance) > 0n) {
          const debit = txRepo.create({
            userId: ut.userId,
            userTariffId: ut.id,
            kind: 'DEBIT',
            source: 'USER_TARIFF',
            service: null,
            quantity: 0,
            unitPrice: '0',
            amount: `-${ut.balance}`,
            description: 'Остаток тарифа списан при окончании срока',
            meta: { reason: 'expire' },
          });
          await txRepo.save(debit);

          // баланс тарифа после списания — ровно ноль
          ut.balance = '0';
        }

        ut.status = 'EXPIRED';
        await utRepo.save(ut);
      }
    });
  }
}
