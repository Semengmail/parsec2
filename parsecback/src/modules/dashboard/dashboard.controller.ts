// src/modules/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { UserId } from '@/common/decorators/user-id.decorator';
import type { DashboardSummary } from './types';

@Controller('dashboard')
@UseGuards(JwtCookieGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('summary')
  async summary(@UserId() userId: number): Promise<DashboardSummary> {
    return this.svc.summary(userId);
  }
}
