import type { TariffRate } from '@/modules/tariffs/entities/tariff-rate.entity';

export type ServiceCode = TariffRate['service'];

export type PrecheckOk = {
  ok: true;
  payer: 'TARIFF' | 'USER_BALANCE';
  userTariffId: number | null;
  unitPrice: string;
  quantity: number;
  total: string;
};

export type PrecheckFail = {
  ok: false;
  reason: 'insufficient_funds' | 'no_price';
  detail?: Record<string, unknown>;
};

export type PrecheckResult = PrecheckOk | PrecheckFail;
