import { apiFetch } from '@/shared/lib/api/api-fetch';
import { apiRoutes } from '@/shared/api/apiRoutes';

/** --- 1. Topup Clients --- */

export interface TopupClientsItem {
  month: string;
  clientsCount: number;
}

export async function fetchTopupClients(params?: {
  threshold?: number;
  tz?: string;
}): Promise<TopupClientsItem[]> {
  const query = new URLSearchParams();
  if (params?.threshold != null)
    query.set('threshold', String(params.threshold));
  if (params?.tz) query.set('tz', params.tz);

  return apiFetch<TopupClientsItem[]>(
    apiRoutes.admin.economyTopupClients(query)
  );
}

/** --- 2. Revenue by services --- */

export interface RevenueServicesItem {
  month: string;
  yandexLive: string;
  googleLive: string;
  frequency: string;
  total: string;
  other?: Record<string, string>;
}

export async function fetchRevenueServices(params?: {
  tz?: string;
}): Promise<RevenueServicesItem[]> {
  const query = new URLSearchParams();
  if (params?.tz) query.set('tz', params.tz);

  return apiFetch<RevenueServicesItem[]>(
    apiRoutes.admin.economyRevenueServices(query)
  );
}

/** --- 3. Topups (month + 4 weeks) --- */

export interface TopupsMonthWeeksItem {
  month: string;
  total: string;
  weeks: [string, string, string, string];
}

export async function fetchTopupsMonthWeeks(params?: {
  tz?: string;
}): Promise<TopupsMonthWeeksItem[]> {
  const query = new URLSearchParams();
  if (params?.tz) query.set('tz', params.tz);

  return apiFetch<TopupsMonthWeeksItem[]>(
    apiRoutes.admin.economyTopupsMonthWeeks(query)
  );
}

/** --- 4. Registrations --- */

export interface RegistrationsItem {
  month: string;
  registrations: number;
}

export async function fetchRegistrations(params?: {
  tz?: string;
}): Promise<RegistrationsItem[]> {
  const query = new URLSearchParams();
  if (params?.tz) query.set('tz', params.tz);

  return apiFetch<RegistrationsItem[]>(
    apiRoutes.admin.economyRegistrations(query)
  );
}
