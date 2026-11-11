import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EconomyService } from './economy.service';
import { EconomyController } from './economy.controller';
import { User } from '@/modules/users/entities/user.entity';
import { Payment } from '@/modules/payment/entities/payment.entity';
import { BillingTransaction } from '@/modules/billing/entities/billing-transaction.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, Payment, BillingTransaction]),
  ],
  providers: [EconomyService],
  controllers: [EconomyController],
  exports: [EconomyService],
})
export class EconomyModule {}
