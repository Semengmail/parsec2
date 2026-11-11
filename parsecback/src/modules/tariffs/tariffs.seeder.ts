// src/modules/tariffs/tariffs.seeder.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tariff } from './entities/tariff.entity';
import { TariffRate } from './entities/tariff-rate.entity';
import { ALL_SERVICES, type ServiceCode } from './tariff.constants';
import { ConfigService } from '@nestjs/config';
import { isStubMode } from '@/common/stub-mode';

type Money = string; // thousandths of RUB (e.g. "15" = 0.015 ₽)

@Injectable()
export class TariffsSeeder implements OnApplicationBootstrap {
  private readonly log = new Logger(TariffsSeeder.name);
  constructor(
    @InjectRepository(Tariff) private readonly tariffs: Repository<Tariff>,
    @InjectRepository(TariffRate)
    private readonly rates: Repository<TariffRate>,
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (isStubMode(this.config)) return;
    // можно отключить через env: if (process.env.SEED_TARIFFS === '0') return;
    await this.seed();
  }

  private async upsertTariff(input: {
    code: 'NONE' | 'NOVA' | 'ORION';
    name: string;
    defaultDurationDays: number;
    minDeposit: Money; // стоимость тарифа при покупке (в тысячных)
    isActive: boolean;
  }): Promise<Tariff> {
    let t = await this.tariffs.findOne({ where: { code: input.code } });
    if (!t) {
      t = this.tariffs.create({
        code: input.code,
        name: input.name,
        defaultDurationDays: input.defaultDurationDays,
        minDeposit: input.minDeposit,
        isActive: input.isActive,
      });
      t = await this.tariffs.save(t);
      this.log.log(`Created tariff ${input.code}`);
    } else {
      // при желании можно синхронизировать название/стоимость:
      // t.name = input.name; t.defaultDurationDays = input.defaultDurationDays; t.minDeposit = input.minDeposit;
      // await this.tariffs.save(t);
    }
    return t;
  }

  private async ensureRate(
    tariffId: number,
    service: ServiceCode,
    unitPrice: Money,
    limitUnits?: number | null,
  ): Promise<void> {
    const exists = await this.rates.findOne({ where: { tariffId, service } });
    if (!exists) {
      const r = this.rates.create({
        tariffId,
        service,
        unitPrice,
        limitUnits: limitUnits ?? null,
      });
      await this.rates.save(r);
      this.log.log(
        `Added rate ${service} for tariffId=${tariffId} = ${unitPrice}`,
      );
    }
  }

  private async seed(): Promise<void> {
    await this.ds.transaction(async () => {
      // Цены по планам (тысячные рубля)
      const PRICE_NONE: Money = '20'; // 0.02 ₽
      const PRICE_NOVA: Money = '15'; // 0.015 ₽
      const PRICE_ORION: Money = '10'; // 0.01 ₽

      // 1) Без тарифа
      const none = await this.upsertTariff({
        code: 'NONE',
        name: 'Без тарифа',
        isActive: true,
        defaultDurationDays: 0,
        minDeposit: '0',
      });
      for (const s of ALL_SERVICES) {
        await this.ensureRate(none.id, s, PRICE_NONE, null);
      }

      // 2) Нова (3000 ₽ / 30 дней)
      const nova = await this.upsertTariff({
        code: 'NOVA',
        name: 'Нова',
        isActive: true,
        defaultDurationDays: 30,
        minDeposit: '3000000', // 3000 ₽
      });
      for (const s of ALL_SERVICES) {
        await this.ensureRate(nova.id, s, PRICE_NOVA, null);
      }

      // 3) Орион (10000 ₽ / 30 дней)
      const orion = await this.upsertTariff({
        code: 'ORION',
        name: 'Орион',
        isActive: true,
        defaultDurationDays: 30,
        minDeposit: '10000000', // 10000 ₽
      });
      for (const s of ALL_SERVICES) {
        await this.ensureRate(orion.id, s, PRICE_ORION, null);
      }
    });
  }
}
