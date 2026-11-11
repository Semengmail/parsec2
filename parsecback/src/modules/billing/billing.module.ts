// src/modules/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingTransaction } from './entities/billing-transaction.entity';
import { BillingService } from './billing.service';
import { TariffsModule } from '../tariffs/tariffs.module';
import { UsersModule } from '../users/users.module';
import { Tariff } from '../tariffs/entities/tariff.entity';
import { BillingPartnerController } from './billing-partner.controller';
import { BillingAdminController } from './billing-admin.controller';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingTransaction, Tariff]),
    TariffsModule,
    UsersModule,
    AuthModule,
    ConfigModule,
  ],
  controllers: [BillingPartnerController, BillingAdminController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
