import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { PaymentService } from '../modules/payment/payment.service';
import { Payment } from '../modules/payment/entities/payment.entity';
import { Referral } from '../modules/referral/entities/referral.entity';
import { UsersService } from '../modules/users/users.service';
import { BillingService } from '../modules/billing/billing.service';
import { ReceiptService } from '../modules/receipt/receipt.service';
import { FrequencyService } from '../modules/frequency/frequency.service';
import { FrequencyTask } from '../modules/frequency/entities/frequency-task.entity';
import { FrequencyChunk } from '../modules/frequency/entities/frequency-chunk.entity';
import { KeyTurboClient } from '../modules/frequency/keyturbo.client';
import { ServicesService } from '../modules/services/services.service';

describe('Stub financial protections', () => {
  it.each([
    {},
    null,
    {
      PaymentId: 'existing',
      OrderId: '1-forged',
      Success: true,
      Status: 'CONFIRMED',
      Amount: 999999,
    },
  ])(
    'ignores webhook %s before reads, writes, receipts or credits',
    async (payload) => {
      const repository = { findOne: jest.fn(), save: jest.fn() };
      const users = { getUserById: jest.fn() };
      const billing = { topUpUserBalance: jest.fn() };
      const receipts = { createReceiptForPayment: jest.fn() };
      const service = new PaymentService(
        repository as unknown as Repository<Payment>,
        repository as unknown as Repository<Referral>,
        users as unknown as UsersService,
        billing as unknown as BillingService,
        new ConfigService({ STUB_MODE: 'true' }),
        receipts as unknown as ReceiptService,
      );
      await service.processWebhook(
        payload as unknown as Record<string, unknown>,
      );
      for (const mock of [
        repository.findOne,
        repository.save,
        users.getUserById,
        billing.topUpUserBalance,
        receipts.createReceiptForPayment,
      ]) {
        expect(mock).not.toHaveBeenCalled();
      }
    },
  );

  it('rejects frequency creation before billing, queues, transactions or providers', async () => {
    const repository = { save: jest.fn(), findOne: jest.fn() };
    const dataSource = { transaction: jest.fn() };
    const keyturbo = { createTask: jest.fn() };
    const billing = { charge: jest.fn() };
    const service = new FrequencyService(
      repository as unknown as Repository<FrequencyTask>,
      repository as unknown as Repository<FrequencyChunk>,
      dataSource as unknown as DataSource,
      keyturbo as unknown as KeyTurboClient,
      billing as unknown as BillingService,
      {} as ServicesService,
      new ConfigService({ STUB_MODE: 'true' }),
    );
    expect(
      await service.createTask(
        1,
        { type: 'frequency', keywords: ['test'] },
        null,
      ),
    ).toMatchObject({ status: 'error', code: 52 });
    for (const mock of [
      repository.save,
      repository.findOne,
      dataSource.transaction,
      keyturbo.createTask,
      billing.charge,
    ]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });
});
