// src/modules/public-api/yandexlive.controller.ts
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { YandexLiveService } from './yandexlive.service';
import {
  buildYandexXmlError,
  buildYandexXmlPending,
  buildYandexXmlOkRich,
} from './xml/yandex-xml';
import { getProp, isPlainObject, isStringArray } from '@/shared/helpers/guards';
import { PublicApiKeyGuard } from '@/common/guards/public-api-key.guard';

// ===== helpers (валидация как в compat-контроллере)
const isNonEmptyQuery = (q: string | undefined): boolean =>
  typeof q === 'string' && q.trim().length > 0;

const isValidLr = (lr: number): boolean =>
  Number.isInteger(lr) && lr >= 1 && lr <= 99_999_999;

// Вайтлист groupby для Яндекса (держим как у Google, при желании сузим)
const isValidYandexGroupby = (n: number | undefined): boolean =>
  n === undefined || n === 10 || n === 20 || n === 30 || n === 50 || n === 100;

// безопасный парсер булевых значений без String(v)
const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
};

// общий DTO для создания задачи (POST и GET)
export class CreatePublicTaskDto {
  @IsString()
  query!: string;

  @IsIn(['desktop', 'mobile'])
  device!: 'desktop' | 'mobile';

  @Type(() => Number)
  @IsInt()
  lr!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  rank?: number;

  @IsOptional()
  @IsIn(['', 'images', 'video'])
  tbm?: '' | 'images' | 'video';

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  related?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  punycode?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  hlword?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  delayed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  groupby?: number;

  @IsOptional()
  @IsIn(['ru', 'by', 'kz', 'com.tr'])
  domain?: 'ru' | 'by' | 'kz' | 'com.tr';
}

@Controller('public/yandexlive/:userId')
@UseGuards(PublicApiKeyGuard)
export class YandexLiveController {
  constructor(private readonly svc: YandexLiveService) {}

  // POST /public/yandexlive/:userId/tasks
  @Post('tasks')
  @HttpCode(202)
  async createPost(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreatePublicTaskDto,
  ): Promise<{ taskId: number; status: 'pending' }> {
    // фиксированный groupby=10 для live (исторически), page из rank по 10
    const groupsOnPage = 10;

    // Базовая валидация входа (быстро, до вызова сервиса)
    if (!isNonEmptyQuery(dto.query)) {
      throw new HttpException('empty_query', HttpStatus.UNPROCESSABLE_ENTITY); // 422
    }
    if (!isValidLr(dto.lr)) {
      throw new HttpException('invalid_lr', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const pageFromRank =
      typeof dto.rank === 'number'
        ? Math.max(1, Math.ceil(dto.rank / groupsOnPage))
        : undefined;
    const page = pageFromRank ?? dto.page ?? 1;

    const payload = {
      query: dto.query,
      lr: dto.lr,
      device: dto.device,
      page,
      ...(typeof dto.latitude === 'number' ? { latitude: dto.latitude } : {}),
      ...(typeof dto.longitude === 'number'
        ? { longitude: dto.longitude }
        : {}),
    } as const;

    try {
      const t = await this.svc.create(userId, payload);
      return { taskId: t.id, status: 'pending' };
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      if (
        msg.includes('insufficient_funds') ||
        msg.includes('payment_required')
      ) {
        // 402 Payment Required
        throw new HttpException(
          'insufficient_funds',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      if (msg.includes('queue_overloaded')) {
        // 503 Service Unavailable
        throw new HttpException(
          'queue_overloaded',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      // дефолт
      throw new HttpException(
        'internal_error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /public/yandexlive/:userId/tasks/create?...  (аналог POST, но поддерживает groupby и доп. опции)
  @Get('tasks/create')
  @HttpCode(202)
  async createGet(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() dto: CreatePublicTaskDto,
  ): Promise<{ taskId: number; status: 'pending' }> {
    // Валидация
    if (!isNonEmptyQuery(dto.query)) {
      throw new HttpException('empty_query', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!isValidLr(dto.lr)) {
      throw new HttpException('invalid_lr', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!isValidYandexGroupby(dto.groupby)) {
      throw new HttpException(
        'invalid_groupby',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (dto.domain && !['ru', 'by', 'kz', 'com.tr'].includes(dto.domain)) {
      throw new HttpException(
        'invalid_domain',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const groupsOnPage = typeof dto.groupby === 'number' ? dto.groupby : 10;
    const pageFromRank =
      typeof dto.rank === 'number'
        ? Math.max(1, Math.ceil(dto.rank / groupsOnPage))
        : undefined;
    const page = pageFromRank ?? dto.page ?? 1;

    const payload = {
      query: dto.query,
      lr: dto.lr,
      device: dto.device,
      page,
      ...(typeof dto.latitude === 'number' ? { latitude: dto.latitude } : {}),
      ...(typeof dto.longitude === 'number'
        ? { longitude: dto.longitude }
        : {}),
      groupby: dto.groupby,
      tbm: dto.tbm ?? undefined,
      related: dto.related,
      punycode: dto.punycode,
      hlword: dto.hlword,
      delayed: dto.delayed,
      domain: dto.domain,
    } as const;

    try {
      const t = await this.svc.create(userId, payload);
      return { taskId: t.id, status: 'pending' };
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      if (
        msg.includes('insufficient_funds') ||
        msg.includes('payment_required')
      ) {
        throw new HttpException(
          'insufficient_funds',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      if (msg.includes('queue_overloaded')) {
        throw new HttpException(
          'queue_overloaded',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        'internal_error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /public/yandexlive/:userId/tasks/:id  -> XML
  @Get('tasks/:id')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async getXml(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<string> {
    try {
      const t = await this.svc.getById(userId, id);

      // брать фактический groupby из задачи, дефолт — 10
      const groupsOnPage = typeof t.groupby === 'number' ? t.groupby : 10;
      const ctx = { query: t.query, page: t.page ?? 1, groupsOnPage };

      if (t.status === 'ERROR') {
        return buildYandexXmlError(500, t.error ?? 'internal_error', ctx);
      }
      if (t.status !== 'COMPLETED' || !t.results) {
        return buildYandexXmlPending({ ...ctx, taskId: t.id });
      }

      // page-level extras из t.extras (типобезопасно)
      const extrasObj: Record<string, unknown> | null = t.extras;
      const rqUnknown = getProp(extrasObj, 'relatedQuestions');
      const kgUnknown = getProp(extrasObj, 'knowledgeGraph');

      const pageExtras = {
        relatedQuestions: isStringArray(rqUnknown) ? rqUnknown : null,
        knowledgeGraph: isPlainObject(kgUnknown) ? kgUnknown : null,
      };

      // rich: отдаём t.results целиком (SerpResultItem[] с extras.*)
      const xml = buildYandexXmlOkRich(t.results, pageExtras, {
        ...ctx,
        totalFound: t.results.length,
      });

      // при необходимости можно чистить задачу как одноразовую:
      // await this.svc.deleteById(userId, t.id).catch(() => void 0);

      return xml;
    } catch {
      return buildYandexXmlError(404, 'task_not_found');
    }
  }
}
