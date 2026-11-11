// src/modules/services/public-info.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  Req,
  Query,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { PublicInfoService } from './public-info.service';
import { PublicInfoQueryDto } from './dto/public-info.query.dto';
import { PublicInfoErrorFilter } from './public-info.error-filter';

// тип ответа (упрощённый, под формат XMLStock)
type PublicInfoResponse = {
  status: 'ok';
  user: {
    key: string;
    id: string;
    tariff: { name: string; cost: string; start: string; end: string };
  };
  urls: Record<
    string,
    {
      method: { xml: string };
      price: string;
      query_today: string;
      query_today_limit: string;
      request_limit: string;
    }
  >;
  soft_id?: string;
};

type PublicBalanceResponse = {
  balance: string; // общий баланс пользователя, в минимальных единицах (как в транзакциях)
  tariffBalance: string; // баланс тарифа (пока заглушка "0" — см. коммент в сервисе)
};

@Controller('public/info')
@UseFilters(PublicInfoErrorFilter)
export class PublicInfoController {
  constructor(private readonly svc: PublicInfoService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getInfo(
    @Query() q: PublicInfoQueryDto,
    @Req() req: Request,
  ): Promise<PublicInfoResponse> {
    const kind = (q.info ?? 'user').toLowerCase();
    if (kind !== 'user') {
      throw new BadRequestException('unsupported info');
    }
    // ключ — это «сырой» API key (string)
    return this.svc.buildUserInfoPayload(q.key, q.soft_id, req);
  }

  @Get('balance')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getBalance(
    @Query() q: PublicInfoQueryDto,
  ): Promise<PublicBalanceResponse> {
    // Здесь не используем `info`, ключ обязателен
    const { balance, tariffBalance } = await this.svc.buildBalancePayload(
      q.key,
    );
    return { balance, tariffBalance };
  }
}
