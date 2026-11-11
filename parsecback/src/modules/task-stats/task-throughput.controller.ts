import { AdminGuard } from '@/common/guards/admin.guard';
// src/modules/task-stats/task-throughput.controller.ts
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaskThroughputService } from './task-throughput.service';

@Controller('api/v1/admin/throughput')
@UseGuards(AdminGuard)
export class TaskThroughputController {
  constructor(private readonly service: TaskThroughputService) {}

  @Get()
  getAll() {
    return this.service.getRecords();
  }

  /**
   * Ручной пересчёт (вместо ожидания cron)
   * GET /api/v1/admin/throughput/rebuild
   */
  @Get('rebuild')
  async rebuild() {
    await this.service.rebuildRecords();
    return { ok: true };
  }

  @Delete()
  async remove(
    @Query('server') server?: string,
    @Query('engine') searchEngine?: string,
  ) {
    if (!server || !searchEngine) {
      throw new BadRequestException('server and engine are required');
    }

    const deleted = await this.service.deleteServerEngineStats({
      server,
      searchEngine,
    });

    return { ok: true, ...deleted };
  }
}
