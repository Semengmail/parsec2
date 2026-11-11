import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsController } from './admin-stats.controller';
import { YandexLiveTask } from '@/modules/public-api/entities/yandexlive-task.entity';
import { GoogleLiveTask } from '@/modules/public-api/entities/googlelive-task.entity';
import { AuthModule } from '../auth/auth.module';
import { TaskStatsModule } from '../task-stats/task-stats.module';
import { LimitsModule } from '@/common/limits/limits.module';
import { QueueAnalyticsService } from './queue-analytics.service';

@Module({
  imports: [
    AuthModule,
    TaskStatsModule,
    LimitsModule,
    TypeOrmModule.forFeature([YandexLiveTask, GoogleLiveTask]),
  ],
  providers: [AdminStatsService, QueueAnalyticsService],
  controllers: [AdminStatsController],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
