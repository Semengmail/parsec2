import type { ServiceCode } from '@/modules/tariffs/tariff.constants';

export interface PartnerBillingReportRow {
  date: string;
  requests: number;
  amount: string;
  service?: ServiceCode; // <-- НЕ обязательное
}

export interface PartnerBillingReport {
  softId: string;
  group: 'day' | 'month';
  rows: PartnerBillingReportRow[];
  summary: {
    totalRequests: number;
    totalAmount: string;
    byService: Partial<ServiceReportMap>; // <-- Partial
  };
}

export type BillingReportGroup = 'day' | 'month';

export type ServiceReportMap = Record<
  ServiceCode,
  {
    requests: number;
    amount: string; // тысячные, положительная строка
  }
>;

export interface PartnerReportParams {
  userId: number;
  softId: string;
  group: BillingReportGroup;
  dateFrom?: Date;
  dateTo?: Date;
  services?: ServiceCode[];
  timezone: string;
  limit: number;
  offset: number;
}

export interface AdminBillingReportRow {
  softId: string;
  userId: number;
  email: string;
  date: string;
  totalRequests: number;
  totalAmount: string;
  services: Partial<ServiceReportMap>;
}

export interface MonthSummary {
  month: string;
  totalRequests: number;
  totalAmount: string;
  byService: Partial<ServiceReportMap>;
}

export interface AdminBillingReport {
  group: BillingReportGroup;
  rows: AdminBillingReportRow[];
  summary: {
    totalRequests: number;
    totalAmount: string;
    byService: Partial<ServiceReportMap>;
    currentMonth?: MonthSummary;
    previousMonth?: MonthSummary;
  };
}

export interface AdminReportParams {
  group: BillingReportGroup;
  dateFrom?: Date;
  dateTo?: Date;
  services?: ServiceCode[];
  timezone: string;
  limit: number;
  offset: number;
  softId?: string;
}
