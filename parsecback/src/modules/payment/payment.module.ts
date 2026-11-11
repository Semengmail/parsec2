import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { AuthModule } from '../auth/auth.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { Referral } from '../referral/entities/referral.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Referral]),
    UsersModule,
    BillingModule,
    AuthModule,
    ReceiptModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
