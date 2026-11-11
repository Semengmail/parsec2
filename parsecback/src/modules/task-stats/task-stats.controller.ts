import { AdminGuard } from '@/common/guards/admin.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { TaskStatsCron } from './task-stats.cron';

@Controller('task-stats')
@UseGuards(AdminGuard)
export class TaskStatsController {
  constructor(private readonly taskStatsCron: TaskStatsCron) {}

  @Get('recalculate-stats')
  async recalculateStats() {
    return this.taskStatsCron.aggregateAllForTest();
  }
}
