import type { ServiceCode } from '@/modules/tariffs/tariff.constants';

export type SummaryRate = {
  service: ServiceCode;
  unitPrice: string; // тысячные ₽
  availableByMoney: number; // целые юниты по балансy тарифа
  limitUnits: number | null;
};

export type DashboardSummary = {
  apiKey: string;
  tariff: {
    code: string;
    name: string;
    balance: string; // тысячные ₽
    expiresAt: string | null; // ISO
  } | null;
  baseTariff: { code: string; name: string } | null;
  rates: SummaryRate[];
  spend: {
    last7d: string; // тысячные ₽, положительное число
    last30d: string;
    total: string;
  };
};
