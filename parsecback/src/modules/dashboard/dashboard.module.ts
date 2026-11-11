import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TariffsModule } from '@/modules/tariffs/tariffs.module';
import { Tariff } from '@/modules/tariffs/entities/tariff.entity';
import { TariffRate } from '@/modules/tariffs/entities/tariff-rate.entity';
import { UserTariff } from '@/modules/tariffs/entities/user-tariff.entity';
import { BillingTransaction } from '@/modules/billing/entities/billing-transaction.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TariffsModule,
    AuthModule,
    UsersModule,
    TypeOrmModule.forFeature([
      Tariff,
      TariffRate,
      UserTariff,
      BillingTransaction,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
