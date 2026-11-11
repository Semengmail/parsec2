import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptService } from './receipt.service';
import { Receipt } from './entities/receipt.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AlertingModule } from '@/shared/alerting/alerting.module';

@Module({
  imports: [TypeOrmModule.forFeature([Receipt, Payment]), AlertingModule],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}
