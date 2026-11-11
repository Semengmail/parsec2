import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import axios, { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';

import {
  DKReceiptResponse,
  DKErrorResponse,
  CreateReceiptBody,
} from './digitalkassa.types';
import { Receipt } from './entities/receipt.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AlertingService } from '@/shared/alerting/alerting.service';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);
  private readonly baseUrl: string;
  private readonly cGroupId: number;
  private readonly actorId: string;
  private readonly actorToken: string;
  private readonly taxation: number;

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
    private readonly config: ConfigService,
    private readonly alerting: AlertingService,
  ) {
    this.baseUrl = this.config.get<string>('DIGITALKASSA_BASE_URL')!;
    this.cGroupId = Number(this.config.get<string>('DIGITALKASSA_CGROUP_ID'));
    this.actorId = this.config.get<string>('DIGITALKASSA_ACTOR_ID')!;
    this.actorToken = this.config.get<string>('DIGITALKASSA_ACTOR_TOKEN')!;
    this.taxation = Number(this.config.get('DIGITALKASSA_TAXATION'));
  }

  private getAuthHeaders(): Record<string, string> {
    const encoded = Buffer.from(
      `${this.actorId}:${this.actorToken}`,
      'utf8',
    ).toString('base64');
    return {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
  }

  private handleAxiosError(
    error: AxiosError<DKErrorResponse>,
    context: 'createReceipt' | 'getReceiptStatus',
  ): never {
    const status = error.response?.status ?? HttpStatus.BAD_REQUEST;
    const payload = error.response?.data;

    const message = payload?.message || `Ошибка DigitalKassa (HTTP ${status})`;

    const codeText = payload?.code ? `code: ${payload.code}` : '';

    const detailsText =
      payload?.details && Object.keys(payload.details).length > 0
        ? `details: ${JSON.stringify(payload.details)}`
        : '';

    const payloadText =
      payload !== undefined
        ? `payload: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`
        : '';

    const textLines = [
      `Контекст: ${context}`,
      `HTTP статус: ${status}`,
      codeText,
      `Сообщение: ${message}`,
      payloadText,
      detailsText,
    ].filter((line) => line.trim().length > 0);

    const text = textLines.join('\n');

    this.alerting.safeCritical('Ошибка фискализации чека', text);

    throw new HttpException({ message, payload }, status);
  }

  private isValidEmail(email: string | null | undefined): boolean {
    if (!email) return false;

    const trimmed = email.trim();
    if (!trimmed) return false;

    const atIndex = trimmed.indexOf('@');
    const dotIndex = trimmed.lastIndexOf('.');

    // должен быть хотя бы один символ до @
    if (atIndex <= 0) return false;

    // точка должна быть после @ и не последним символом
    if (dotIndex <= atIndex + 1) return false;
    if (dotIndex === trimmed.length - 1) return false;

    return true;
  }

  async createReceiptForPayment(payment: Payment): Promise<Receipt> {
    const receiptId = `${payment.id}-${Date.now()}`;
    const url = `${this.baseUrl}/c_groups/${this.cGroupId}/receipts/${receiptId}`;

    const userEmail = payment.user?.email ?? null;
    const notifyEmails = this.isValidEmail(userEmail) ? [userEmail.trim()] : [];

    const body: CreateReceiptBody = {
      type: 1,
      taxation: this.taxation,
      is_internet: this.config.get('DIGITALKASSA_IS_INTERNET') === '1' ? 1 : 0,
      timezone: Number(this.config.get('DIGITALKASSA_TIMEZONE') || 5), // Default to UTC+5 ОМСК

      items: [
        {
          name: 'Пополнение баланса',
          price: Number(payment.amount),
          quantity: 1,
          amount: Number(payment.amount),

          type: 10, // ПЛАТЁЖ
          vat: 6, // НДС не облагается
          unit: 0, // Штучно

          payment_method: 4, // Полный расчёт
          payment_object: 10, // Платёж
        },
      ],

      amount: {
        cash: 0,
        cashless: Number(payment.amount),
      },

      notify: {
        emails: notifyEmails,
      },

      loc: {
        billing_place: 'https://parsec.toolzar.ru',
      },
    };

    let responseData: DKReceiptResponse;

    try {
      const response = await axios.post<DKReceiptResponse>(url, body, {
        headers: this.getAuthHeaders(),
      });
      responseData = response.data;
    } catch (error) {
      this.handleAxiosError(
        error as AxiosError<DKErrorResponse>,
        'createReceipt',
      );
    }

    const dto: DeepPartial<Receipt> = {
      receiptId,
      paymentId: payment.id,
      response: responseData,
      status: responseData.doc ? 'DONE' : 'PENDING',
      fiscalSign: responseData.doc?.fiscal_sign,
      fiscalNum: responseData.doc?.fiscal_num,
      receiptUrl: responseData.service?.receipt_url,
    };

    const receipt = this.receiptRepo.create(dto);

    await this.receiptRepo.save(receipt);

    return receipt;
  }

  async getReceiptStatus(receiptId: string): Promise<DKReceiptResponse> {
    const url = `${this.baseUrl}/c_groups/${this.cGroupId}/receipts/${receiptId}`;

    try {
      const response = await axios.get<DKReceiptResponse>(url, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleAxiosError(
        error as AxiosError<DKErrorResponse>,
        'getReceiptStatus',
      );
    }
  }
}
