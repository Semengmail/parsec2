// src/modules/task-stats/task-stats.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AggregatedRow {
  periodStart: string;
  searchEngine: string;
  server: string;
  totalPages: number;
  avgDurationSec: number;
  pagesPerSec: number;
}

@Injectable()
export class TaskStatsService {
  private readonly logger = new Logger(TaskStatsService.name);

  constructor(private readonly ds: DataSource) {}

  // исправленный getDistinctValues
  private async getDistinctValues(
    column: 'server' | 'searchEngine',
    table: string,
  ): Promise<string[]> {
    const rows: unknown = await this.ds.query(`
    SELECT DISTINCT "${column}"
    FROM ${table}
    ORDER BY "${column}" ASC;
  `);

    return Array.isArray(rows)
      ? rows
          .map((r) => {
            const v = (r as Record<string, unknown>)[column];
            return typeof v === 'string' ? v : '';
          })
          .filter(Boolean)
      : [];
  }

  async recordTaskCompletion(params: {
    searchEngine: string;
    server: string;
    sourceTaskId: number;
    device: 'desktop' | 'mobile';
    durationMs: number;
    pages?: number;
  }) {
    try {
      const pages = Math.max(1, Math.trunc(params.pages ?? 1));
      await this.ds.transaction(async (manager) => {
        const inserted: { id: number }[] = await manager.query(
          `
            INSERT INTO task_stats_raw
              ("searchEngine", "server", "sourceTaskId", "durationMs", "pages")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("searchEngine", "sourceTaskId", "server") DO NOTHING
            RETURNING id
          `,
          [
            params.searchEngine,
            params.server,
            params.sourceTaskId,
            params.durationMs,
            pages,
          ],
        );

        if (inserted.length === 0) return;

        await manager.query(
          `
            INSERT INTO task_stats_minute
              ("periodStart", "searchEngine", "device", "totalPages")
            VALUES (date_trunc('minute', now()), $1, $2, $3)
            ON CONFLICT ("searchEngine", "device", "periodStart")
            DO UPDATE SET "totalPages" = task_stats_minute."totalPages" + EXCLUDED."totalPages"
          `,
          [params.searchEngine, params.device, pages],
        );
      });
    } catch (err) {
      this.logger.warn(`recordTaskCompletion error: ${(err as Error).message}`);
    }
  }

  async getPreviousMinuteThroughput(): Promise<{
    total: number;
    byEngine: Record<
      'yandexlive' | 'googlelive',
      { total: number; desktop: number; mobile: number }
    >;
  }> {
    const rows: { searchEngine: string; device: string; totalPages: number }[] =
      await this.ds.query(`
        SELECT "searchEngine", "device", "totalPages"
        FROM task_stats_minute
        WHERE "periodStart" = date_trunc('minute', now()) - interval '1 minute'
      `);
    const result = {
      total: 0,
      byEngine: {
        yandexlive: { total: 0, desktop: 0, mobile: 0 },
        googlelive: { total: 0, desktop: 0, mobile: 0 },
      },
    };

    for (const row of rows) {
      if (
        (row.searchEngine !== 'yandexlive' &&
          row.searchEngine !== 'googlelive') ||
        (row.device !== 'desktop' && row.device !== 'mobile')
      ) {
        continue;
      }
      const pages = Number(row.totalPages) || 0;
      result.total += pages;
      result.byEngine[row.searchEngine].total += pages;
      result.byEngine[row.searchEngine][row.device] += pages;
    }

    return result;
  }

  // 1. Часовая агрегация: берём завершённые часы
  async aggregateHourly() {
    await this.ds.query(`
    INSERT INTO task_stats_hour ("periodStart","searchEngine","server","totalPages","avgDurationSec","pagesPerSec")
    SELECT
      date_trunc('hour',"createdAt") AS "periodStart",
      "searchEngine","server",
      SUM("pages") AS "totalPages",
      AVG("durationMs")/1000.0 AS "avgDurationSec",
      CASE WHEN SUM("durationMs")>0 THEN SUM("pages")/(SUM("durationMs")/1000.0) ELSE 0 END AS "pagesPerSec"
    FROM task_stats_raw
    WHERE "createdAt" < date_trunc('hour', now())
    GROUP BY 1,2,3
    ON CONFLICT ("periodStart","searchEngine","server") DO NOTHING;
  `);

    await this.ds.query(`
      DELETE FROM task_stats_minute
      WHERE "periodStart" < date_trunc('minute', now() - interval '2 days');
    `);

    // Удаляем только то, что уже агрегировано
    await this.ds.query(`
    DELETE FROM task_stats_raw
    WHERE "createdAt" < date_trunc('hour', now());
  `);
  }

  // 2. Дневная агрегация: берём завершённые дни
  async aggregateDaily() {
    await this.ds.query(`
    INSERT INTO task_stats_day ("periodStart","searchEngine","server","totalPages","avgDurationSec","pagesPerSec")
    SELECT
      date_trunc('day',"periodStart") AS "periodStart",
      "searchEngine","server",
      SUM("totalPages") AS "totalPages",
      AVG("avgDurationSec") AS "avgDurationSec",
      AVG("pagesPerSec") AS "pagesPerSec"
    FROM task_stats_hour
    WHERE "periodStart" < date_trunc('day', now() AT TIME ZONE 'Europe/Moscow')
    GROUP BY 1,2,3
    ON CONFLICT ("periodStart","searchEngine","server") DO UPDATE
      SET "totalPages"=EXCLUDED."totalPages",
          "avgDurationSec"=EXCLUDED."avgDurationSec",
          "pagesPerSec"=EXCLUDED."pagesPerSec";
  `);

    // чистим старые часы
    await this.ds.query(`
    DELETE FROM task_stats_hour
    WHERE "periodStart" < date_trunc('day', now() - interval '32 days');
  `);
  }

  // 3. Недельная агрегация
  async aggregateWeekly() {
    await this.ds.query(`
    INSERT INTO task_stats_week ("periodStart","searchEngine","server","totalPages","avgDurationSec","pagesPerSec")
    SELECT
      date_trunc('week',"periodStart") AS "periodStart",
      "searchEngine","server",
      SUM("totalPages"), AVG("avgDurationSec"), AVG("pagesPerSec")
    FROM task_stats_day
    WHERE "periodStart" < date_trunc('week', now() AT TIME ZONE 'Europe/Moscow')
    GROUP BY 1,2,3
    ON CONFLICT ("periodStart","searchEngine","server") DO UPDATE
      SET "totalPages"=EXCLUDED."totalPages",
          "avgDurationSec"=EXCLUDED."avgDurationSec",
          "pagesPerSec"=EXCLUDED."pagesPerSec";
  `);
  }

  // 4. Месячная агрегация
  async aggregateMonthly() {
    await this.ds.query(`
    INSERT INTO task_stats_month ("periodStart","searchEngine","server","totalPages","avgDurationSec","pagesPerSec")
    SELECT
      date_trunc('month',"periodStart") AS "periodStart",
      "searchEngine","server",
      SUM("totalPages"), AVG("avgDurationSec"), AVG("pagesPerSec")
    FROM task_stats_week
    WHERE "periodStart" < date_trunc('month', now() AT TIME ZONE 'Europe/Moscow')
    GROUP BY 1,2,3
    ON CONFLICT ("periodStart","searchEngine","server") DO UPDATE
      SET "totalPages"=EXCLUDED."totalPages",
          "avgDurationSec"=EXCLUDED."avgDurationSec",
          "pagesPerSec"=EXCLUDED."pagesPerSec";
  `);
  }

  async getAggregatedStats(params: {
    period: 'hour' | 'day' | 'week' | 'month';
    searchEngine?: string;
    server?: string;
  }): Promise<{
    data: AggregatedRow[];
    servers: string[];
    searchEngines: string[];
  }> {
    const { period, searchEngine, server } = params;

    const table =
      period === 'day'
        ? 'task_stats_day'
        : period === 'week'
          ? 'task_stats_week'
          : period === 'month'
            ? 'task_stats_month'
            : 'task_stats_hour';

    const where: string[] = [];
    if (searchEngine)
      where.push(`"searchEngine" = '${searchEngine.replace(/'/g, "''")}'`);
    if (server) where.push(`"server" = '${server.replace(/'/g, "''")}'`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 1️⃣ Завершённые периоды
    const baseRows: unknown = await this.ds.query(`
    SELECT
      "periodStart",
      "searchEngine",
      "server",
      "totalPages",
      "avgDurationSec",
      "pagesPerSec"
    FROM ${table}
    ${whereSql}
    ORDER BY "periodStart" ASC
  `);

    const data: AggregatedRow[] = Array.isArray(baseRows)
      ? baseRows.map((r): AggregatedRow => {
          const o = r as Record<string, unknown>;
          return {
            periodStart: new Date(o.periodStart as string).toISOString(),
            searchEngine: String(o.searchEngine),
            server: String(o.server),
            totalPages: Number(o.totalPages ?? 0),
            avgDurationSec: Number(o.avgDurationSec ?? 0),
            pagesPerSec: Number(o.pagesPerSec ?? 0),
          };
        })
      : [];

    let finalData = data;

    function mergePeriods(
      base: AggregatedRow[],
      current: AggregatedRow[],
    ): AggregatedRow[] {
      const map = new Map<string, AggregatedRow>();

      for (const r of base) {
        map.set(`${r.periodStart}|${r.searchEngine}|${r.server}`, r);
      }

      for (const r of current) {
        map.set(`${r.periodStart}|${r.searchEngine}|${r.server}`, r);
      }

      return Array.from(map.values());
    }

    if (period === 'hour') {
      const current = await this.addCurrentHour(where);
      finalData = mergePeriods(data, current);
    }

    if (period === 'day') {
      const current = await this.addCurrentDay(where);
      finalData = mergePeriods(data, current);
    }

    if (period === 'week') {
      const current = await this.addCurrentWeek(where);
      finalData = mergePeriods(data, current);
    }

    if (period === 'month') {
      const current = await this.addCurrentMonth(where);
      finalData = mergePeriods(data, current);
    }

    // 3️⃣ Фильтры
    const servers = await this.getDistinctValues('server', table);
    const searchEngines = await this.getDistinctValues('searchEngine', table);

    return {
      data: finalData.sort((a, b) =>
        a.periodStart.localeCompare(b.periodStart),
      ),
      servers,
      searchEngines,
    };
  }

  private async addCurrentHour(where: string[]): Promise<AggregatedRow[]> {
    const nowHourRows: unknown = await this.ds.query(`
    SELECT
      date_trunc('hour', "createdAt") AS "periodStart",
      "searchEngine",
      "server",
      SUM("pages") AS "totalPages",
      AVG("durationMs") / 1000.0 AS "avgDurationSec",
      CASE WHEN SUM("durationMs") > 0
        THEN SUM("pages") / (SUM("durationMs") / 1000.0)
        ELSE 0 END AS "pagesPerSec"
    FROM task_stats_raw
    ${where.length ? `WHERE ${where.join(' AND ')} AND` : 'WHERE'}
      "createdAt" >= date_trunc('hour', now())
    GROUP BY 1, 2, 3
    ORDER BY 1 ASC;
  `);

    return Array.isArray(nowHourRows)
      ? nowHourRows.map((r): AggregatedRow => {
          const o = r as Record<string, unknown>;
          return {
            periodStart: new Date(o['periodStart'] as string).toISOString(),
            searchEngine:
              typeof o['searchEngine'] === 'string' ? o['searchEngine'] : '',
            server: typeof o['server'] === 'string' ? o['server'] : '',
            totalPages: Number(o['totalPages'] ?? 0),
            avgDurationSec: Number(o['avgDurationSec'] ?? 0),
            pagesPerSec: Number(o['pagesPerSec'] ?? 0),
          };
        })
      : [];
  }

  private async addCurrentDay(where: string[]): Promise<AggregatedRow[]> {
    // 1️⃣ Собираем все завершённые часы за сегодня
    const fromHours: unknown = await this.ds.query(`
    SELECT
      date_trunc('day', "periodStart") AS "periodStart",
      "searchEngine",
      "server",
      SUM("totalPages") AS "totalPages",
      AVG("avgDurationSec") AS "avgDurationSec",
      AVG("pagesPerSec") AS "pagesPerSec"
    FROM task_stats_hour
    WHERE "periodStart" >= date_trunc('day', now())
    ${where.length ? `AND ${where.join(' AND ')}` : ''}
    GROUP BY 1, 2, 3
  `);

    // 2️⃣ Добавляем текущий незавершённый час (прямо из raw)
    const fromRaw: unknown = await this.ds.query(`
    SELECT
      date_trunc('day', now()) AS "periodStart",
      "searchEngine",
      "server",
      SUM("pages") AS "totalPages",
      AVG("durationMs") / 1000.0 AS "avgDurationSec",
      CASE WHEN SUM("durationMs") > 0
        THEN SUM("pages") / (SUM("durationMs") / 1000.0)
        ELSE 0 END AS "pagesPerSec"
    FROM task_stats_raw
    ${where.length ? `WHERE ${where.join(' AND ')} AND` : 'WHERE'}
      "createdAt" >= date_trunc('day', now())
    GROUP BY 2, 3
  `);

    const rows = [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...(Array.isArray(fromHours) ? fromHours : []),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...(Array.isArray(fromRaw) ? fromRaw : []),
    ];

    return rows.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        periodStart: new Date(o['periodStart'] as string).toISOString(),
        searchEngine:
          typeof o['searchEngine'] === 'string' ? o['searchEngine'] : '',
        server: typeof o['server'] === 'string' ? o['server'] : '',
        totalPages: Number(o['totalPages'] ?? 0),
        avgDurationSec: Number(o['avgDurationSec'] ?? 0),
        pagesPerSec: Number(o['pagesPerSec'] ?? 0),
      };
    });
  }

  private async addCurrentWeek(where: string[]): Promise<AggregatedRow[]> {
    const fromDays: unknown = await this.ds.query(`
    SELECT
      date_trunc('week', "periodStart") AS "periodStart",
      "searchEngine",
      "server",
      SUM("totalPages") AS "totalPages",
      AVG("avgDurationSec") AS "avgDurationSec",
      AVG("pagesPerSec") AS "pagesPerSec"
    FROM task_stats_day
    WHERE "periodStart" >= date_trunc('week', now())
    ${where.length ? `AND ${where.join(' AND ')}` : ''}
    GROUP BY 1, 2, 3
  `);

    const today = await this.addCurrentDay(where);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = [...(Array.isArray(fromDays) ? fromDays : []), ...today];

    return rows.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        periodStart: new Date(o['periodStart'] as string).toISOString(),
        searchEngine:
          typeof o['searchEngine'] === 'string' ? o['searchEngine'] : '',
        server: typeof o['server'] === 'string' ? o['server'] : '',
        totalPages: Number(o['totalPages'] ?? 0),
        avgDurationSec: Number(o['avgDurationSec'] ?? 0),
        pagesPerSec: Number(o['pagesPerSec'] ?? 0),
      };
    });
  }

  private async addCurrentMonth(where: string[]): Promise<AggregatedRow[]> {
    const fromWeeks: unknown = await this.ds.query(`
    SELECT
      date_trunc('month', "periodStart") AS "periodStart",
      "searchEngine",
      "server",
      SUM("totalPages") AS "totalPages",
      AVG("avgDurationSec") AS "avgDurationSec",
      AVG("pagesPerSec") AS "pagesPerSec"
    FROM task_stats_week
    WHERE "periodStart" >= date_trunc('month', now())
    ${where.length ? `AND ${where.join(' AND ')}` : ''}
    GROUP BY 1, 2, 3
  `);

    const fromWeek = await this.addCurrentWeek(where);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = [...(Array.isArray(fromWeeks) ? fromWeeks : []), ...fromWeek];

    return rows.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        periodStart: new Date(o['periodStart'] as string).toISOString(),
        searchEngine:
          typeof o['searchEngine'] === 'string' ? o['searchEngine'] : '',
        server: typeof o['server'] === 'string' ? o['server'] : '',
        totalPages: Number(o['totalPages'] ?? 0),
        avgDurationSec: Number(o['avgDurationSec'] ?? 0),
        pagesPerSec: Number(o['pagesPerSec'] ?? 0),
      };
    });
  }
}
