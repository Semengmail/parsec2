import { AuthModule } from '../auth/auth.module';
// src/modules/task-stats/task-stats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TaskStatsDay,
  TaskStatsWeek,
  TaskStatsMonth,
} from './entities/task-stats-agg.entity';
import { TaskStatsService } from './task-stats.service';
import { TaskStatsCron } from './task-stats.cron';
import { TaskStatsRaw } from './entities/task-stats-raw.entity';
import { TaskStatsHour } from './entities/task-stats-hour.entity';
import { TaskStatsController } from './task-stats.controller';
import { TaskThroughputController } from './task-throughput.controller';
import { TaskThroughputService } from './task-throughput.service';
import { TaskThroughputHour } from './entities/task-throughput-hour.entity';
import { TaskThroughputRecord } from './entities/task-throughput-record.entity';
import { TaskStatsMinute } from './entities/task-stats-minute.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      TaskStatsRaw,
      TaskStatsMinute,
      TaskStatsHour,
      TaskStatsDay,
      TaskStatsWeek,
      TaskStatsMonth,
      TaskThroughputHour,
      TaskThroughputRecord,
    ]),
  ],
  controllers: [TaskStatsController, TaskThroughputController],
  providers: [TaskStatsService, TaskStatsCron, TaskThroughputService],
  exports: [TaskStatsService, TaskStatsCron],
})
export class TaskStatsModule {}
