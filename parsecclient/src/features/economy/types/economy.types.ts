export interface MonthValue {
  month: string; // YYYY-MM
  value: number; // сумма / количество
}

export interface RevenueMonth {
  month: string;
  yandexlive: number;
  googlelive: number;
  frequency: number;
}

export interface TopupsMonthWeek {
  month: string;
  total: number;
  weeks: number[]; // [w1, w2, w3, w4]
}

export interface EconomyResponse {
  topupClients: MonthValue[];
  revenue: RevenueMonth[];
  topups: TopupsMonthWeek[];
  registrations: MonthValue[];
}
