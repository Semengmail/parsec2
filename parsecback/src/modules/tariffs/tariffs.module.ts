// src/modules/tariffs/tariffs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tariff } from './entities/tariff.entity';
import { TariffRate } from './entities/tariff-rate.entity';
import { UserTariff } from './entities/user-tariff.entity';
import { TariffsService } from './tariffs.service';
import { TariffCronService } from './tariff-cron.service';
import { BillingTransaction } from '../billing/entities/billing-transaction.entity';
import { UsersModule } from '../users/users.module';
import { TariffsSeeder } from './tariffs.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tariff,
      TariffRate,
      UserTariff,
      BillingTransaction,
    ]),
    UsersModule,
  ],
  providers: [TariffsService, TariffCronService, TariffsSeeder],
  exports: [TariffsService],
})
export class TariffsModule {}
