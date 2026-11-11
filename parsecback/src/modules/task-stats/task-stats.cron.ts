// src/modules/task-stats/task-stats.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TaskStatsService } from './task-stats.service';

const MSK_TZ = 'Europe/Moscow';

@Injectable()
export class TaskStatsCron {
  constructor(private readonly stats: TaskStatsService) {}

  // каждый час в 05 минут (по Москве)
  @Cron('5 * * * *', { timeZone: MSK_TZ })
  async aggregateHourly() {
    await this.stats.aggregateHourly();
  }

  // каждый день в 00:10 (по Москве)
  @Cron('10 0 * * *', { timeZone: MSK_TZ })
  async aggregateDaily() {
    await this.stats.aggregateDaily();
  }

  // каждый понедельник в 00:15 (по Москве)
  @Cron('15 0 * * 1', { timeZone: MSK_TZ })
  async aggregateWeekly() {
    await this.stats.aggregateWeekly();
  }

  // 1-го числа каждого месяца в 00:20 (по Москве)
  @Cron('20 0 1 * *', { timeZone: MSK_TZ })
  async aggregateMonthly() {
    await this.stats.aggregateMonthly();
  }

  // ⚠️ ТЕСТОВЫЙ КРОН — УДАЛИТЬ ПОСЛЕ ПРОВЕРКИ
  // @Cron('02 11 * * *', { timeZone: MSK_TZ })
  async aggregateAllForTest() {
    // порядок КРИТИЧЕН
    await this.stats.aggregateHourly();
    await this.stats.aggregateDaily();
    await this.stats.aggregateWeekly();
    await this.stats.aggregateMonthly();
  }
}
