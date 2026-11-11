// src\modules\admin-stats\admin-stats.controller.ts

import {
  Controller,
  Get,
  ForbiddenException,
  UseGuards,
  Query,
  Put,
  Body,
} from '@nestjs/common';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { AdminStatsService } from './admin-stats.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { TaskStatsService } from '../task-stats/task-stats.service';
import type { GlobalLimitsValue } from '@/common/limits/entities/global-limits-settings.entity';
import { LimitsService } from '@/common/limits/limits.service';
import { QueueAnalyticsService } from './queue-analytics.service';

@Controller('api/v1/admin')
@UseGuards(JwtCookieGuard)
export class AdminStatsController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly taskStats: TaskStatsService,
    private readonly limits: LimitsService,
    private readonly queueAnalytics: QueueAnalyticsService,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser() user: User) {
    if (!user.role?.includes('admin')) {
      throw new ForbiddenException('admin_only');
    }
    return this.stats.getQueueStats();
  }

  @Get('stats')
  async getStats(
    @CurrentUser() user: User,
    @Query('period') period: 'hour' | 'day' | 'week' | 'month' = 'hour',
    @Query('engine') searchEngine?: string,
    @Query('server') server?: string,
  ) {
    if (!user.role?.includes('admin')) {
      throw new ForbiddenException('admin_only');
    }
    return this.taskStats.getAggregatedStats({ period, searchEngine, server });
  }

  @Get('queue-analytics')
  async getQueueAnalytics(@CurrentUser() user: User) {
    if (!user.role?.includes('admin')) {
      throw new ForbiddenException('admin_only');
    }
    return this.queueAnalytics.getAnalytics();
  }

  @Get('settings')
  async getSettings(@CurrentUser() user: User): Promise<GlobalLimitsValue> {
    if (!user.role?.includes('admin')) {
      throw new ForbiddenException('admin_only');
    }
    return this.limits.getSettings();
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser() user: User,
    @Body() body: GlobalLimitsValue,
  ): Promise<GlobalLimitsValue> {
    if (!user.role?.includes('admin')) {
      throw new ForbiddenException('admin_only');
    }
    return this.limits.updateSettings(body);
  }
}
