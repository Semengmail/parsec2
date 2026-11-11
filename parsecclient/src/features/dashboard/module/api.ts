import { apiRoutes } from '@/shared/api/apiRoutes';
import { apiFetch } from '@/shared/lib/api/api-fetch';

export type SummaryRate = {
  service:
    | 'YANDEX_P1'
    | 'GOOGLE_TOP100'
    | 'YANDEX_LIVE'
    | 'GOOGLE_LIVE'
    | 'WEBMASTER'
    | 'WORDSTAT';
  unitPrice: string;
  availableByMoney: number;
  limitUnits: number | null;
};
export type DashboardSummary = {
  apiKey: string;
  tariff: {
    code: string;
    name: string;
    balance: string;
    expiresAt: string | null;
  } | null;
  baseTariff: { code: string; name: string } | null;
  rates: SummaryRate[];
  spend: { last7d: string; last30d: string; total: string };
};

export async function apiGetDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(apiRoutes.dashboard.summary);
}

export async function apiRotateMyApiKey(): Promise<{ apiKey: string }> {
  return apiFetch<{ apiKey: string }>(apiRoutes.users.rotateMyApiKey, {
    method: 'POST',
  });
}
