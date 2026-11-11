import { apiFetch } from '@/shared/lib/api/api-fetch';
import { apiRoutes } from '@/shared/api/apiRoutes';
import type { ServiceCode } from '@/shared/api/types/service-code';

// === Типы, которые уже есть в backend ===
export interface PartnerBillingReportRow {
  date: string;
  requests: number;
  amount: string;
  service?: ServiceCode;
}

export interface PartnerBillingSummary {
  totalRequests: number;
  totalAmount: string;
  byService: Record<ServiceCode, { requests: number; amount: string }>;
}

export interface PartnerBillingResponse {
  softId: string | null;
  group: 'day' | 'month';
  rows: PartnerBillingReportRow[];
  summary: PartnerBillingSummary;
}

export interface AdminBillingReportRow {
  softId: string;
  userId: number;
  email: string;
  date: string;
  totalRequests: number;
  totalAmount: string;
  services: Record<ServiceCode, { requests: number; amount: string }>;
}

export interface AdminBillingReport {
  group: 'day' | 'month';
  rows: AdminBillingReportRow[];
  summary: {
    totalRequests: number;
    totalAmount: string;
    byService: Record<ServiceCode, { requests: number; amount: string }>;
    currentMonth?: unknown;
    previousMonth?: unknown;
  };
}

// ======= API =======

// ПАРТНЁР
function makeQuery(
  params: Record<string, string | number | undefined>
): string {
  const out = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join('&');
  return out ? `?${out}` : '';
}

export async function apiGetPartnerReport(params: {
  group?: 'day' | 'month';
  dateFrom?: string;
  dateTo?: string;
  services?: string;
  limit?: number;
  offset?: number;
}): Promise<PartnerBillingResponse> {
  const qs = makeQuery(params);
  return apiFetch<PartnerBillingResponse>(
    `${apiRoutes.billing.partnerReport}${qs}`
  );
}

export async function apiGetAdminPartnerReport(params: {
  group?: 'day' | 'month';
  dateFrom?: string;
  dateTo?: string;
  services?: string;
  softId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminBillingReport> {
  const qs = makeQuery(params);
  return apiFetch<AdminBillingReport>(`${apiRoutes.billing.adminReport}${qs}`);
}

export async function apiGetSoftIds(): Promise<string[]> {
  const resp = await apiFetch<{ softIds: string[] }>(
    apiRoutes.billing.adminSoftIds
  );
  return resp.softIds;
}
