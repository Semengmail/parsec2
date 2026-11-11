import { apiRoutes } from '@/shared/api/apiRoutes';
import { apiFetch } from '@/shared/lib/api/api-fetch';

export type CreatePaymentRequest = {
  sum: number; // сумма в рублях
};

export type CreatePaymentResponse = {
  paymentUrl: string;
};

/**
 * Создание платежа на сервере (инициализация через Tinkoff)
 */
export async function apiCreatePayment(
  payload: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
  return apiFetch<CreatePaymentResponse>(apiRoutes.payment.create, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
