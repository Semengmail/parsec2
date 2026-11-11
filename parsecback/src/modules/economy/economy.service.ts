import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { addStr } from '@/modules/billing/utils/money';

export interface MonthlyTopupClientsItem {
  /** YYYY-MM */
  month: string;
  /** Сколько уникальных клиентов в этом месяце пополнили на сумму >= thresholdRub */
  clientsCount: number;
}

export interface MonthlyServiceRevenueItem {
  /** YYYY-MM */
  month: string;
  /** Доход по сервисам в тысячных рубля (все значения >= 0, строка BigInt) */
  yandexLive: string;
  googleLive: string;
  frequency: string;
  /** Сумма по трём сервисам */
  total: string;
  /** Прочие сервисы (если появятся) */
  other?: Record<string, string>;
}

export interface MonthlyTopupsWithWeeksItem {
  /** YYYY-MM */
  month: string;
  /** Общая сумма пополнений за месяц (тысячные рубля) */
  total: string;
  /** 4 "недели" месяца: [1–7, 8–14, 15–21, 22–конец] в тысячных рубля */
  weeks: [string, string, string, string];
}

export interface MonthlyRegistrationsItem {
  /** YYYY-MM */
  month: string;
  /** Количество новых пользователей (без antistatic) */
  registrations: number;
}

@Injectable()
export class EconomyService {
  // при необходимости можно вынести в конфиг
  private readonly defaultTimezone = 'Europe/Moscow';

  /**
   * ServiceCode для графика доходов.
   * ПОДСТАВЬ сюда реальные значения из tariff.constants, если они другие.
   */
  private readonly SERVICE_YANDEX_LIVE = 'YANDEX_LIVE';
  private readonly SERVICE_GOOGLE_LIVE = 'GOOGLE_LIVE';
  private readonly SERVICE_FREQUENCY = 'FREQUENCY';

  constructor(private readonly ds: DataSource) {}

  private getSafeTimezone(tz?: string | null): string {
    if (!tz || typeof tz !== 'string' || !tz.trim()) {
      return this.defaultTimezone;
    }
    return tz;
  }

  /**
   * 1) По месяцам: сколько клиентов пополнили баланс на сумму >= thresholdRub.
   * thresholdRub — в рублях (Payment.amount DECIMAL(10,2)).
   */
  async getMonthlyTopupClients(params?: {
    thresholdRub?: number;
    timezone?: string;
  }): Promise<MonthlyTopupClientsItem[]> {
    const thresholdRub = params?.thresholdRub ?? 100;
    const tz = this.getSafeTimezone(params?.timezone);

    type Row = {
      month: string;
      clients_count: number;
    };

    const rows = await this.ds.query<Row[]>(
      `
    WITH per_user AS (
      SELECT
        to_char(p."createdAt" AT TIME ZONE $1, 'YYYY-MM') AS month,
        p."userId",
        SUM(p.amount)::numeric AS sum_rub
      FROM payments p
      JOIN users u ON u.id = p."userId"
      WHERE p.status = 'CONFIRMED'
        AND p.processed = true
        AND (u.role IS NULL OR NOT ('antistatic' = ANY(u.role)))
      GROUP BY month, p."userId"
    )
    SELECT month, COUNT(*)::int AS clients_count
    FROM per_user
    WHERE sum_rub >= $2
    GROUP BY month
    ORDER BY month;
    `,
      [tz, thresholdRub],
    );

    return rows.map((r) => ({
      month: r.month,
      clientsCount: r.clients_count,
    }));
  }

  /**
   * 2) Доход по месяцам по сервисам:
   * YANDEX_LIVE / GOOGLE_LIVE / FREQUENCY.
   * На основе billing_transactions (DEBIT, POSTED), без пользователей с ролью antistatic.
   */
  async getMonthlyServiceRevenue(params?: {
    timezone?: string;
  }): Promise<MonthlyServiceRevenueItem[]> {
    const tz = this.getSafeTimezone(params?.timezone);

    type Row = {
      month: string;
      service: string | null;
      amount: string; // bigInt (уже SUM(ABS(amount)))
    };

    const rows = await this.ds.query<Row[]>(
      `
      SELECT
        to_char(t."createdAt" AT TIME ZONE $1, 'YYYY-MM') AS month,
        t.service,
        SUM(ABS(t.amount))::bigint AS amount
      FROM billing_transactions t
      JOIN users u ON u.id = t."userId"
      WHERE t.kind = 'DEBIT'
        AND t.state = 'POSTED'
        AND (u.role IS NULL OR NOT ('antistatic' = ANY(u.role)))
        AND t.service IS NOT NULL
      GROUP BY month, t.service
      ORDER BY month, t.service;
      `,
      [tz],
    );

    const map = new Map<string, MonthlyServiceRevenueItem>();

    for (const r of rows) {
      const month = r.month;
      const svc = r.service ?? 'UNKNOWN';
      const amount = r.amount ?? '0';

      let item = map.get(month);
      if (!item) {
        item = {
          month,
          yandexLive: '0',
          googleLive: '0',
          frequency: '0',
          total: '0',
        };
        map.set(month, item);
      }

      if (svc === this.SERVICE_YANDEX_LIVE) {
        item.yandexLive = addStr(item.yandexLive, amount);
      } else if (svc === this.SERVICE_GOOGLE_LIVE) {
        item.googleLive = addStr(item.googleLive, amount);
      } else if (svc === this.SERVICE_FREQUENCY) {
        item.frequency = addStr(item.frequency, amount);
      } else {
        if (!item.other) item.other = {};
        const prev = item.other[svc] ?? '0';
        item.other[svc] = addStr(prev, amount);
      }

      item.total = addStr(item.total, amount);
    }

    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * 3) Суммы пополнения баланса по месяцам и "неделям".
   * Берём CREDIT, USER_BALANCE, POSTED; режем месяц на 4 части:
   *   w1: дни  1–7
   *   w2: дни  8–14
   *   w3: дни 15–21
   *   w4: дни 22–конец
   */
  async getMonthlyTopupsWithWeeks(params?: {
    timezone?: string;
  }): Promise<MonthlyTopupsWithWeeksItem[]> {
    const tz = this.getSafeTimezone(params?.timezone);

    type Row = {
      month: string;
      day: number;
      amount_thousandths: string;
    };

    const rows = await this.ds.query<Row[]>(
      `
    SELECT
      to_char(p."createdAt" AT TIME ZONE $1, 'YYYY-MM') AS month,
      EXTRACT(DAY FROM (p."createdAt" AT TIME ZONE $1))::int AS day,
      SUM(ROUND(p.amount * 1000))::bigint AS amount_thousandths
    FROM payments p
    JOIN users u ON u.id = p."userId"
    WHERE p.status = 'CONFIRMED'
      AND p.processed = true
      AND (u.role IS NULL OR NOT ('antistatic' = ANY(u.role)))
    GROUP BY month, day
    ORDER BY month, day;
    `,
      [tz],
    );

    const map = new Map<string, MonthlyTopupsWithWeeksItem>();

    for (const r of rows) {
      const month = r.month;
      const day = r.day;
      const amount = r.amount_thousandths ?? '0';

      let item = map.get(month);
      if (!item) {
        item = { month, total: '0', weeks: ['0', '0', '0', '0'] };
        map.set(month, item);
      }

      const idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;

      item.total = addStr(item.total, amount);
      item.weeks[idx] = addStr(item.weeks[idx], amount);
    }

    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * 4) Количество регистраций по месяцам (без antistatic).
   */
  async getMonthlyRegistrations(params?: {
    timezone?: string;
  }): Promise<MonthlyRegistrationsItem[]> {
    const tz = this.getSafeTimezone(params?.timezone);

    type Row = {
      month: string;
      cnt: number;
    };

    const rows = await this.ds.query<Row[]>(
      `
      SELECT
        to_char(u."createdAt" AT TIME ZONE $1, 'YYYY-MM') AS month,
        COUNT(*)::int AS cnt
      FROM users u
      WHERE (u.role IS NULL OR NOT ('antistatic' = ANY(u.role)))
      GROUP BY month
      ORDER BY month;
      `,
      [tz],
    );

    return rows.map((r) => ({
      month: r.month,
      registrations: r.cnt,
    }));
  }
}
