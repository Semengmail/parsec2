import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

import { BillingService } from './billing.service';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import type { ServiceCode } from '../tariffs/tariff.constants';

type SafeRequest = ExpressRequest<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  Record<string, unknown>
> & {
  cookies: Record<string, string | undefined>;
};

function isUserLike(
  x: unknown,
): x is { id: number; email: string; softId?: string | null } {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const idOk = typeof o.id === 'number' && Number.isInteger(o.id);
  const emailOk = typeof o.email === 'string';
  return idOk && emailOk;
}

class PartnerBillingReportQueryDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  group?: 'day' | 'month';

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /**
   * Список сервисов через запятую, например:
   * "GOOGLE_LIVE,YANDEX_LIVE,FREQUENCY"
   */
  @IsOptional()
  @IsString()
  services?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

@ApiTags('Billing / Partner')
@Controller('billing/partner')
export class BillingPartnerController {
  constructor(
    private readonly billing: BillingService,
    private readonly auth: AuthService,
    private readonly cfg: ConfigService,
    private readonly users: UsersService,
  ) {}

  @Get('report')
  @ApiOperation({
    summary: 'Отчёт партнёра по списаниям (по softId)',
    description:
      'Возвращает агрегированные списания по дням или месяцам для партнёра по его softId. Если softId нет — пустой ответ.',
  })
  @ApiQuery({
    name: 'group',
    required: false,
    description: 'Группировка: day | month (по умолчанию day)',
  })
  @ApiQuery({
    name: 'timezone',
    required: false,
    description: 'Таймзона для группировки (например, Europe/Moscow)',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Начало периода (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Конец периода (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'services',
    required: false,
    description:
      'Коды сервисов через запятую (например: GOOGLE_LIVE,YANDEX_LIVE,FREQUENCY)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Максимум строк (по умолчанию 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Смещение для пагинации (по умолчанию 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Отчёт по списаниям для партнёра',
  })
  async report(
    @Req() req: SafeRequest,
    @Query() q: PartnerBillingReportQueryDto,
  ) {
    const cookieName = this.cfg.get<string>('COOKIE_NAME', 'psk.sid');
    const token = req.cookies[cookieName] as string | undefined;
    if (!token) throw new UnauthorizedException('no_token');

    const { sub } = this.auth.verifyToken(token);
    const user = await this.users.getUserById(sub);
    if (!isUserLike(user)) {
      throw new UnauthorizedException('user_not_found');
    }

    if (!user.softId) {
      // У пользователя нет softId — партнёрский отчёт не нужен
      return {
        softId: null,
        group: q.group ?? 'day',
        rows: [],
        summary: {
          totalRequests: 0,
          totalAmount: '0',
          byService: {},
        },
      };
    }

    const group: 'day' | 'month' = q.group ?? 'day';
    const timezone = q.timezone || 'Europe/Moscow';

    const dateFrom = q.dateFrom ? new Date(q.dateFrom) : undefined;
    const dateTo = q.dateTo ? new Date(q.dateTo) : undefined;

    let services: ServiceCode[] | undefined;
    if (q.services) {
      services = q.services
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is ServiceCode => s.length > 0);
    }

    const limit = q.limit && q.limit > 0 ? Math.min(q.limit, 500) : 100;
    const offset = q.offset && q.offset > 0 ? q.offset : 0;

    return this.billing.getPartnerSoftReport({
      userId: user.id,
      softId: user.softId,
      group,
      dateFrom,
      dateTo,
      services,
      timezone,
      limit,
      offset,
    });
  }
}
