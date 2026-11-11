// src/modules/tariffs/tariffs.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Tariff } from './entities/tariff.entity';
import { TariffRate } from './entities/tariff-rate.entity';
import { UserTariff } from './entities/user-tariff.entity';
import { BillingTransaction } from '../billing/entities/billing-transaction.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

function subStr(a: string, b: string): string {
  // безопасная арифметика в тысячных долях рубля
  return (BigInt(a) - BigInt(b)).toString();
}
function addStr(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

@Injectable()
export class TariffsService {
  constructor(
    @InjectRepository(Tariff) private readonly tariffRepo: Repository<Tariff>,
    @InjectRepository(TariffRate)
    private readonly rateRepo: Repository<TariffRate>,
    @InjectRepository(UserTariff)
    private readonly userTariffRepo: Repository<UserTariff>,
    @InjectRepository(BillingTransaction)
    private readonly txRepo: Repository<BillingTransaction>,
    private readonly users: UsersService,
    private readonly ds: DataSource,
  ) {}

  async getTariffByCode(code: Tariff['code']): Promise<Tariff | null> {
    return this.tariffRepo.findOne({ where: { code, isActive: true } });
  }

  async getPriceByTariffCode(
    code: Tariff['code'],
    service: TariffRate['service'],
  ): Promise<string> {
    const t = await this.getTariffByCode(code);
    if (!t) throw new NotFoundException('tariff_not_found');
    return this.getPrice(t.id, service);
  }

  async purchaseTariff(
    userId: number,
    tariffCode: Tariff['code'],
  ): Promise<UserTariff> {
    const tariff = await this.tariffRepo.findOne({
      where: { code: tariffCode, isActive: true },
    });
    if (!tariff) throw new NotFoundException('tariff_not_found');

    const user = await this.users.getUserById(userId); // 404 если нет
    if (BigInt(user.balance) < BigInt(tariff.minDeposit)) {
      throw new BadRequestException('insufficient_balance');
    }

    const now = new Date();
    const expires = new Date(
      now.getTime() + tariff.defaultDurationDays * 24 * 60 * 60 * 1000,
    );

    return this.ds.transaction(async (trx: EntityManager) => {
      // 1) списываем с общего баланса
      user.balance = subStr(user.balance, tariff.minDeposit);
      await trx.getRepository(User).save(user);

      // 2) создаём пользовательский тариф
      const ut = trx.getRepository(UserTariff).create({
        userId,
        tariffId: tariff.id,
        balance: tariff.minDeposit,
        startsAt: now,
        expiresAt: expires,
        status: 'ACTIVE',
      });
      await trx.getRepository(UserTariff).save(ut);

      // 3) леджер: дебет пользователя
      const debit = trx.getRepository(BillingTransaction).create({
        userId,
        userTariffId: null,
        kind: 'DEBIT',
        source: 'USER_BALANCE',
        service: null,
        quantity: 0,
        unitPrice: '0',
        amount: `-${tariff.minDeposit}`,
        description: `Покупка тарифа ${tariff.name}`,
        meta: { tariffId: tariff.id },
      });
      // 4) леджер: кредит тарифа
      const credit = trx.getRepository(BillingTransaction).create({
        userId,
        userTariffId: ut.id,
        kind: 'CREDIT',
        source: 'USER_TARIFF',
        service: null,
        quantity: 0,
        unitPrice: '0',
        amount: tariff.minDeposit,
        description: `Зачисление на тариф ${tariff.name}`,
        meta: { tariffId: tariff.id },
      });
      await trx.getRepository(BillingTransaction).save([debit, credit]);

      return ut;
    });
  }

  async getActiveUserTariff(userId: number): Promise<UserTariff | null> {
    const nowIso = new Date().toISOString();
    return this.userTariffRepo
      .createQueryBuilder('ut')
      .where('ut.userId = :userId', { userId })
      .andWhere('ut.status = :st', { st: 'ACTIVE' })
      .andWhere('ut.startsAt <= :now AND ut.expiresAt > :now', { now: nowIso })
      .orderBy('ut.expiresAt', 'DESC')
      .getOne();
  }

  async getPrice(
    tariffId: number,
    service: TariffRate['service'],
  ): Promise<string> {
    const rate = await this.rateRepo.findOne({ where: { tariffId, service } });
    if (!rate) throw new NotFoundException('rate_not_found');
    return rate.unitPrice;
  }

  /**
   * Рефанд на общий баланс пользователя с опциональной компенсацией.
   * @param userId            ID пользователя
   * @param amount            сумма рефанда (тысячные рубля), должна быть >= 0
   * @param description       описание операции (для леджера)
   * @param originalTxId      (опц.) ID исходной транзакции, к которой относится возврат
   * @param compensationExtra (опц.) доп. компенсация (тысячные рубля), >= 0
   */
  async refundToUserBalance(params: {
    userId: number;
    amount: string;
    description: string;
    originalTxId?: number;
    compensationExtra?: string;
  }): Promise<void> {
    const { userId, amount, description, originalTxId, compensationExtra } =
      params;

    if (BigInt(amount) < 0n) {
      throw new BadRequestException('refund_amount_must_be_non_negative');
    }
    const extra = compensationExtra ? BigInt(compensationExtra) : 0n;
    if (extra < 0n) {
      throw new BadRequestException('compensation_must_be_non_negative');
    }
    const total = (BigInt(amount) + extra).toString();

    const user = await this.users.getUserById(userId);

    await this.ds.transaction(async (trx: EntityManager) => {
      // пополняем общий баланс
      user.balance = addStr(user.balance, total);
      await trx.getRepository(User).save(user);

      // леджер: кредит USER_BALANCE
      const credit = trx.getRepository(BillingTransaction).create({
        userId,
        userTariffId: null,
        kind: 'CREDIT',
        source: 'USER_BALANCE',
        service: null,
        quantity: 0,
        unitPrice: '0',
        amount: total,
        description,
        meta: originalTxId
          ? { refundOf: originalTxId, compensationExtra: extra.toString() }
          : { compensationExtra: extra.toString() },
      });
      await trx.getRepository(BillingTransaction).save(credit);
    });
  }
}
