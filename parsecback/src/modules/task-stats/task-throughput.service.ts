// src/modules/task-stats/task-throughput.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import {
  TaskThroughputRecord,
  ThroughputPeriod,
} from './entities/task-throughput-record.entity';

@Injectable()
export class TaskThroughputService {
  private readonly log = new Logger(TaskThroughputService.name);

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(TaskThroughputRecord)
    private readonly recordRepo: Repository<TaskThroughputRecord>,
  ) {}

  /**
   * Автоматический пересчёт раз в сутки
   * (ночью, когда минимальная нагрузка)
   */
  @Cron('0 20 3 * * *')
  async rebuildDaily(): Promise<void> {
    this.log.log('Throughput rebuild started');

    await this.rebuildRecords();

    this.log.log('Throughput rebuild finished');
  }

  /**
   * Пересчёт всех периодов
   */
  async rebuildRecords(): Promise<void> {
    await this.buildRecord('day', 1);
    await this.buildRecord('week', 7);
    await this.buildRecord('month', 30);
    await this.buildRecord('all_time', null);
  }

  /**
   * Строим throughput-record:
   * 👉 берём ЛУЧШИЙ ЧАС по totalPages
   */
  private async buildRecord(
    period: ThroughputPeriod,
    days: number | null,
  ): Promise<void> {
    await this.dataSource.query(
      `
WITH best_hour AS (
  SELECT DISTINCT ON ("server", "searchEngine")
    "server",
    "searchEngine",
    "periodStart"  AS hour,
    "totalPages"
  FROM task_stats_hour
  WHERE "totalPages" > 0
    AND (
      $1::int IS NULL
      OR "periodStart" >= now() - ($1 || ' days')::interval
    )
  ORDER BY
    "server",
    "searchEngine",
    "totalPages" DESC
)
INSERT INTO task_throughput_record
  (
    "server",
    "searchEngine",
    "period",
    "hour",
    "pagesPerSec",
    "totalPages",
    "activeMinutes"
  )
SELECT
  "server",
  "searchEngine",
  $2,
  hour,
  ("totalPages"::float / 3600.0), -- purely informational
  "totalPages",
  60
FROM best_hour
ON CONFLICT ("server", "searchEngine", "period")
DO UPDATE SET
  "hour"          = EXCLUDED."hour",
  "pagesPerSec"   = EXCLUDED."pagesPerSec",
  "totalPages"    = EXCLUDED."totalPages",
  "activeMinutes" = EXCLUDED."activeMinutes",
  "computedAt"    = now();
      `,
      [days, period],
    );
  }

  /**
   * Получение данных для UI / API
   */
  async getRecords(): Promise<TaskThroughputRecord[]> {
    return this.recordRepo.find({
      order: {
        server: 'ASC',
        searchEngine: 'ASC',
        period: 'ASC',
      },
    });
  }

  async deleteServerEngineStats(params: {
    server: string;
    searchEngine: string;
  }): Promise<{
    recordsDeleted: number;
    hoursDeleted: number;
    rawDeleted: number;
  }> {
    const rows = await this.dataSource.query<
      Array<{
        recordsDeleted: number;
        hoursDeleted: number;
        rawDeleted: number;
      }>
    >(
      `
WITH deleted_records AS (
  DELETE FROM task_throughput_record
  WHERE "server" = $1 AND "searchEngine" = $2
  RETURNING 1
),
deleted_hours AS (
  DELETE FROM task_stats_hour
  WHERE "server" = $1 AND "searchEngine" = $2
  RETURNING 1
),
deleted_raw AS (
  DELETE FROM task_stats_raw
  WHERE "server" = $1 AND "searchEngine" = $2
  RETURNING 1
)
SELECT
  (SELECT count(*)::int FROM deleted_records) AS "recordsDeleted",
  (SELECT count(*)::int FROM deleted_hours) AS "hoursDeleted",
  (SELECT count(*)::int FROM deleted_raw) AS "rawDeleted";
      `,
      [params.server, params.searchEngine],
    );

    return rows[0] ?? { recordsDeleted: 0, hoursDeleted: 0, rawDeleted: 0 };
  }
}
