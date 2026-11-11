import { apiFetch } from '@/shared/lib/api/api-fetch';

export type MoneyStr = string;

export type ServiceSummary = {
  spend: { today: MoneyStr; last7d: MoneyStr; last30d: MoneyStr };
  pricePerUnit: MoneyStr;
  tariff: {
    code: 'NONE' | 'NOVA' | 'ORION';
    name: string;
    expiresAt: string | null;
    balance: MoneyStr;
  } | null;
  queriesLeft: number;
};

export type SeriesGroup = 'hour' | 'day' | 'month';
export type SeriesPoint = { at: string; amount: MoneyStr };

export type ServiceDescriptor = {
  title: string;
  slug: string;
  code: string;
  method: 'GET' | 'POST';
  help: { title: string; href: string }[];
  supports: { device?: boolean; lr?: boolean; geo?: boolean };
};

export type ServiceSettingsDto = {
  device?: 'desktop' | 'mobile';
  lr?: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type SettingsResponse = {
  descriptor: ServiceDescriptor;
  settings: ServiceSettingsDto;
  publicUrlExample: string;
  publicUrlResultsExample?: string;
};

export function getServiceSummary(slug: string): Promise<ServiceSummary> {
  return apiFetch(`/services/${slug}/summary`);
}

export function getServiceSeries(
  slug: string,
  group: SeriesGroup,
  from?: string,
  to?: string
) {
  const p = new URLSearchParams({ group });
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  return apiFetch<SeriesPoint[]>(`/services/${slug}/series?${p.toString()}`);
}

export function getServiceSettings(slug: string): Promise<SettingsResponse> {
  return apiFetch(`/services/${slug}/settings`);
}

export function saveServiceSettings(
  slug: string,
  dto: ServiceSettingsDto
): Promise<{ ok: true }> {
  return apiFetch(`/services/${slug}/settings`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}
