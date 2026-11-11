import { AdminGuard } from '@/common/guards/admin.guard';
// src/modules/test-bench/test-bench.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TestBenchService } from './test-bench.service';
import { GetChecksDto } from './dto/get-checks.dto';
import { GetPositionSummaryDto } from './dto/get-position-summary.dto';
import { SelectorReportDto } from './dto/selector-report.dto';
import { GetPositionsDto } from './dto/get-positions.dto';
import { TestBenchCaptchaService } from './test-bench-captcha.service';

@Controller('api/v1/admin/testbench')
@UseGuards(AdminGuard)
export class TestBenchController {
  constructor(
    private readonly service: TestBenchService,
    private readonly captchaService: TestBenchCaptchaService,
  ) {}

  @Get('runs')
  async runs(
    @Query('engine') engine: 'all' | 'yandex' | 'google' = 'all',
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.max(1, Math.min(500, Number(limitStr ?? 200) || 200));
    const rows = await this.service.getRuns({ limit, engine });
    // Можно отдать как есть; фронту будет удобно строить график по startedAt/pagesPerMinute
    return rows;
  }

  @Get('latest-speed')
  async latestSpeed() {
    return this.service.getLatestSpeeds(); // { yandex: number|null, google: number|null }
  }

  @Get('run')
  async run() {
    await this.service.runAll();
  }

  /** Чеки (алерты) за последние N дней */
  @Get('checks')
  getChecks(@Query() dto: GetChecksDto) {
    return this.service.getChecks({
      engine: dto.engine,
      days: dto.days,
    });
  }

  /** Агрегированные результаты по позициям тестового сайта */
  @Get('positions-summary')
  getPositionsSummary(@Query() dto: GetPositionSummaryDto) {
    return this.service.getPositionSummary({
      engine: dto.engine,
      days: dto.days,
    });
  }

  /** Репорт от бота по селекторам (спец-фразы типа selector) */
  @Post('selectors/report')
  saveSelectorReport(@Body() dto: SelectorReportDto) {
    return this.service.saveSelectorReport(dto);
  }

  /** История запусков селектор-теста */
  @Get('selectors/runs')
  getSelectorRuns(@Query('limit') limitStr?: string) {
    const limit = Math.max(1, Math.min(500, Number(limitStr ?? 100) || 100));
    return this.service.getSelectorRuns(limit);
  }

  /** Сырые позиции тестового сайта по датам/фразам */
  @Get('positions')
  getPositions(@Query() dto: GetPositionsDto) {
    return this.service.getPositions({
      engine: dto.engine,
      days: dto.days,
    });
  }

  @Get('captcha/metrics')
  async manualCaptchaMetrics() {
    await this.service.sendCaptchaMetricsReport();
    return { ok: true };
  }

  @Get('captcha/history')
  async captchaHistory(
    @Query('serverId') serverId?: string,
    @Query('days') daysStr?: string,
  ) {
    const days = Math.max(1, Math.min(30, Number(daysStr ?? 30)));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.captchaService.getMetrics({ from, serverId });
  }

  @Delete('captcha/history/:serverId')
  async deleteCaptchaHistory(@Param('serverId') serverId: string) {
    const deleted = await this.captchaService.deleteMetricsByServer(serverId);
    return { ok: true, deleted };
  }
}
