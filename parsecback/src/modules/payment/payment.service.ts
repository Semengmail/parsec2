import { createHash } from 'crypto';
import got from 'got';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UsersService } from '../users/users.service';
import { BillingService } from '../billing/billing.service';
import { ReceiptService } from '../receipt/receipt.service';
import { Referral } from '../referral/entities/referral.entity';
import { isStubMode } from '@/common/stub-mode';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly terminalKey: string;
  private readonly terminalPassword: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    private readonly usersService: UsersService,
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
    private readonly receiptService: ReceiptService,
  ) {
    this.terminalKey =
      this.configService.get<string>('TINKOFF_TERMINAL_KEY') ?? '';
    this.terminalPassword =
      this.configService.get<string>('TINKOFF_TERMINAL_SECRET') ?? '';
  }

  /** Создаёт платёж и возвращает URL оплаты */
  async createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<{ paymentUrl: string }> {
    const { userId, sum } = createPaymentDto;
    if (!userId || !sum || sum <= 0) {
      throw new HttpException('Invalid userId or sum', HttpStatus.BAD_REQUEST);
    }

    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const orderId = `${userId}-${Date.now()}`;

    try {
      const response = await this.sendTinkoffRequest<InitPaymentResponse>({
        endpoint: 'Init',
        payload: {
          OrderId: orderId,
          Amount: Math.round(sum * 100),
          PayType: 'O',
          Description: `Пополнение баланса на сумму ${sum} ₽`,
          SuccessURL: `${this.configService.get<string>(
            'FRONTEND_URL',
          )}/payment/payment-success`,
          FailURL: `${this.configService.get<string>(
            'FRONTEND_URL',
          )}/payment/payment-error`,
          NotificationURL: `${this.configService.get<string>(
            'PUBLIC_URL',
          )}/payment/notify`,
        },
      });

      if (!response.Success) {
        throw new HttpException(
          `Ошибка создания платежа: ${response.Message}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const payment = this.paymentRepository.create({
        orderId,
        paymentId: String(response.PaymentId),
        status: response.Status,
        user,
        amount: sum,
      });
      await this.paymentRepository.save(payment);

      return { paymentUrl: response.PaymentURL ?? '' };
    } catch (error) {
      this.logger.error('Ошибка при создании платежа:', error);
      throw new HttpException(
        'Ошибка при создании платежа',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Обработка webhook-а от банка */
  async processWebhook(
    notificationData: Record<string, unknown>,
  ): Promise<void> {
    if (isStubMode(this.configService)) return;

    // ✅ Безопасное приведение типов с проверкой типа
    const Success =
      typeof notificationData.Success === 'boolean'
        ? notificationData.Success
        : false;
    const OrderId =
      typeof notificationData.OrderId === 'string'
        ? notificationData.OrderId
        : '';
    const PaymentId =
      typeof notificationData.PaymentId === 'string' ||
      typeof notificationData.PaymentId === 'number'
        ? notificationData.PaymentId
        : '';
    const Status =
      typeof notificationData.Status === 'string'
        ? notificationData.Status
        : '';
    const Amount =
      typeof notificationData.Amount === 'number'
        ? notificationData.Amount
        : Number(notificationData.Amount ?? 0);

    this.logger.log('Webhook received:', notificationData);

    const [userId] = OrderId.split('-').map((part) => Number(part));
    if (!PaymentId || !userId) {
      this.logger.error('Некорректные данные webhook.');
      return;
    }

    const payment = await this.paymentRepository.findOne({
      where: { paymentId: PaymentId.toString() },
    });
    if (!payment) {
      this.logger.warn(`Payment ${PaymentId} not found.`);
      return;
    }

    if (payment.processed) {
      this.logger.log(`Payment ${PaymentId} already processed. Skipping.`);
      return;
    }

    if (!Success || Status !== 'CONFIRMED') {
      this.logger.warn(`Payment ${PaymentId} not confirmed. Status=${Status}`);
      return;
    }

    const user = await this.usersService.getUserById(userId);
    if (!user) {
      this.logger.error(`User ${userId} not found.`);
      return;
    }

    const amountStr = Math.round((Amount / 100) * 1000).toString();

    await this.billingService.topUpUserBalance({
      userId,
      amount: amountStr,
      description: 'Пополнение баланса через Tinkoff терминал',
      meta: { paymentId: PaymentId },
    });

    payment.status = 'CONFIRMED';
    payment.processed = true;
    await this.paymentRepository.save(payment);

    try {
      if (this.configService.get<string>('ENV') !== 'development')
        await this.receiptService.createReceiptForPayment(payment);
    } catch (err) {
      this.logger.error(
        `Ошибка фискализации чека для paymentId=${payment.paymentId}:`,
        err,
      );
    }

    // ===== РЕФЕРАЛЬНЫЙ БОНУС (best-effort) =====
    try {
      const referral = await this.referralRepository.findOne({
        where: {
          invitee: { id: user.id },
          bonusGiven: false,
        },
        relations: ['referrer', 'invitee'],
      });

      if (referral && !referral.bonusGiven) {
        const amountRub = Amount / 100; // ₽
        let bonusRub = 0;

        // --- правила бонуса (как в старом сервисе) ---
        if (amountRub < 500) bonusRub = amountRub * 2;
        else if (amountRub < 1000) bonusRub = 750;
        else bonusRub = 1000;

        // 👉 переводим в тысячные доли
        const bonusStr = Math.round(bonusRub * 1000).toString();

        // ✅ начисляем приглашённому
        await this.billingService.topUpUserBalance({
          userId: user.id,
          amount: bonusStr,
          description: `🎁 Реферальный бонус за первое пополнение`,
          meta: { referralId: referral.id },
        });

        // ✅ начисляем пригласившему
        await this.billingService.topUpUserBalance({
          userId: referral.referrer.id,
          amount: bonusStr,
          description: `💸 Реферальный доход за пользователя ${user.email}`,
          meta: { referralId: referral.id },
        });

        // ✅ фиксируем бонус
        referral.bonusGiven = true;
        referral.bonusAmount = bonusRub;
        referral.bonusGivenAt = new Date();

        await this.referralRepository.save(referral);

        this.logger.log(
          `✅ Referral bonus ${bonusRub}₽ paid: referrer=${referral.referrer.id}, invitee=${user.id}`,
        );
      }
    } catch (err) {
      // ❗ никогда не ломаем платёж
      this.logger.error(
        `❌ Referral bonus failed for user=${user.id}, payment=${PaymentId}`,
        err,
      );
    }
  }

  /** Проверка статуса платежа по ID */
  async getPaymentStatus(paymentId: string) {
    try {
      const response = await this.sendTinkoffRequest<TinkoffResponse>({
        endpoint: 'GetState',
        payload: { PaymentId: paymentId },
      });

      if (!response.Success) {
        throw new HttpException(
          `Ошибка проверки статуса: ${response.Message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return response;
    } catch (error) {
      this.logger.error('Ошибка проверки статуса платежа:', error);
      throw new HttpException(
        'Ошибка проверки статуса платежа',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async sendTinkoffRequest<T extends TinkoffResponse>({
    endpoint,
    payload,
  }: {
    endpoint: 'Init' | 'GetState';
    payload: Record<string, string | number | boolean | undefined>;
  }): Promise<T> {
    const body = {
      TerminalKey: this.terminalKey,
      ...payload,
    };

    return got
      .post(`https://securepay.tinkoff.ru/v2/${endpoint}`, {
        json: {
          ...body,
          Token: this.createTinkoffToken(body),
        },
        responseType: 'json',
      })
      .json<T>();
  }

  private createTinkoffToken(
    payload: Record<string, string | number | boolean | undefined>,
  ): string {
    const signString = Object.entries({
      ...payload,
      Password: this.terminalPassword,
    })
      .filter(
        ([key, value]) =>
          value !== undefined && !['Token', 'Receipt', 'DATA'].includes(key),
      )
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([, value]) => String(value))
      .join('');

    return createHash('sha256').update(signString).digest('hex');
  }
}

export interface TinkoffResponse {
  Success: boolean;
  Message?: string;
  Status?: string;
}

interface InitPaymentResponse extends TinkoffResponse {
  PaymentId: number | string;
  PaymentURL?: string;
}
