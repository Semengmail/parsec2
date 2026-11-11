import { AdminGuard } from '@/common/guards/admin.guard';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EconomyService } from './economy.service';

@Controller('admin/economy')
@UseGuards(AdminGuard)
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  /**
   * График: по месяцам, сколько клиентов пополнили баланс на сумму >= thresholdRub.
   * GET /admin/economy/topup-clients?threshold=100&tz=Europe/Moscow
   */
  @Get('topup-clients')
  async getTopupClients(
    @Query('threshold') threshold?: string,
    @Query('tz') tz?: string,
  ) {
    const thr = threshold ? Number(threshold) : undefined;
    return this.economy.getMonthlyTopupClients({
      thresholdRub: thr,
      timezone: tz,
    });
  }

  /**
   * График: прибыль по месяцам по сервисам (YANDEX_LIVE / GOOGLE_LIVE / FREQUENCY).
   * GET /admin/economy/revenue-services?tz=Europe/Moscow
   */
  @Get('revenue-services')
  async getRevenueServices(@Query('tz') tz?: string) {
    return this.economy.getMonthlyServiceRevenue({ timezone: tz });
  }

  /**
   * График: суммы пополнения баланса по месяцам и "неделям".
   * GET /admin/economy/topups-month-weeks?tz=Europe/Moscow
   */
  @Get('topups-month-weeks')
  async getTopupsMonthWeeks(@Query('tz') tz?: string) {
    return this.economy.getMonthlyTopupsWithWeeks({ timezone: tz });
  }

  /**
   * График: количество регистраций по месяцам (без antistatic).
   * GET /admin/economy/registrations?tz=Europe/Moscow
   */
  @Get('registrations')
  async getRegistrations(@Query('tz') tz?: string) {
    return this.economy.getMonthlyRegistrations({ timezone: tz });
  }
}
