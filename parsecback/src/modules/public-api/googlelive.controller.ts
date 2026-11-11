// src/modules/public-api/googlelive.controller.ts
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
  Matches,
  Max,
  Min,
} from 'class-validator';

import { GoogleLiveService } from './googlelive.service';
import {
  buildYandexXmlError,
  buildYandexXmlOkRich,
  buildYandexXmlPending,
} from './xml/yandex-xml'; // богаче, со всеми тегами
import { PublicApiKeyGuard } from '@/common/guards/public-api-key.guard';
import { getProp, isPlainObject, isStringArray } from '@/shared/helpers/guards';

// Validators
function isValidGoogleGroupby(n: number | undefined): boolean {
  return n === 10 || n === 20 || n === 30 || n === 50 || n === 100;
}
function isNonEmptyQuery(q: string | undefined): boolean {
  return typeof q === 'string' && q.trim().length > 0;
}
function isValidLr(lr: number): boolean {
  return Number.isInteger(lr) && lr >= 1 && lr <= 999_999;
}
function isValidDomainString(s: string | undefined): boolean {
  if (!s) return true; // опционально
  return /^(\d+|[a-z]{2,}(?:\.[a-z]{2,})*)$/.test(s.trim().toLowerCase());
}

// ——— хелперы без any ———
const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
};
function normalizeDomainInput(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s.length ? s : undefined;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return undefined;
}

// ——— расширенный DTO: как в compat ———
export class CreateGooglePublicTaskDto {
  @IsString() query!: string;

  @IsIn(['desktop', 'mobile']) device!: 'desktop' | 'mobile';

  @Type(() => Number) @IsInt() lr!: number;

  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;

  // пагинация / приоритет ранга
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) rank?: number;

  // дополнительные опции (всё как в compat)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  groupby?: number;

  @IsOptional()
  @Transform(({ value }): string | undefined => normalizeDomainInput(value), {
    toClassOnly: true,
  })
  @IsString()
  @Matches(/^(\d+|[a-z]{2,}(?:\.[a-z]{2,})*)$/)
  domain?: string;

  @IsOptional() @Type(() => Number) @IsInt() domainId?: number;

  @IsOptional() @IsIn(['', 'images', 'video']) tbm?: '' | 'images' | 'video';
  @IsOptional()
  @IsIn(['', 'qdr:h', 'qdr:d', 'qdr:w', 'qdr:m', 'qdr:y'])
  tbs?: '' | 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y';

  @IsOptional() @IsString() hl?: string;
  @IsOptional() @IsString() uule?: string; // сервис сам сгенерит из lat/lon, но не мешает принимать

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  ads?: boolean;
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  related?: boolean;
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  video?: boolean;
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  filter?: boolean;
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
}

@Controller('public/googlelive/:userId')
@UseGuards(PublicApiKeyGuard)
export class GoogleLiveController {
  constructor(private readonly svc: GoogleLiveService) {}

  private failJson(code: number, error: string): never {
    // 4xx/5xx — выбирайте под задачу; здесь 400/402/500
    const status =
      code === 200
        ? HttpStatus.PAYMENT_REQUIRED
        : code >= 500
          ? HttpStatus.BAD_GATEWAY
          : HttpStatus.BAD_REQUEST;
    throw new HttpException({ code, error }, status);
  }

  // общая утилита для create: считает page из rank и формирует payload
  private buildCreatePayload(dto: CreateGooglePublicTaskDto) {
    // 2 — пустой запрос
    if (!isNonEmptyQuery(dto.query)) {
      this.failJson(2, 'empty_query');
    }
    // 103 — lr вне допустимого диапазона
    if (!isValidLr(dto.lr)) {
      this.failJson(103, 'invalid_lr');
    }
    // 102 — неправильный groupby для Google
    const rawGroupby = typeof dto.groupby === 'number' ? dto.groupby : 30;
    if (!isValidGoogleGroupby(rawGroupby)) {
      this.failJson(102, 'invalid_groupby');
    }
    // 106 — неверный domain
    if (!isValidDomainString(dto.domain)) {
      this.failJson(106, 'invalid_domain');
    }

    // groupsOnPage по-умолчанию 30 (как в compat-контроллере)
    const groupsOnPage =
      typeof dto.groupby === 'number' && dto.groupby >= 10 && dto.groupby <= 100
        ? dto.groupby
        : 30;

    const pageFromRank =
      typeof dto.rank === 'number'
        ? Math.max(1, Math.ceil(dto.rank / groupsOnPage))
        : undefined;

    const page = pageFromRank ?? dto.page ?? 1;

    // строго типизированный payload под GoogleLiveService.create
    const payload = {
      query: dto.query,
      lr: dto.lr,
      device: dto.device,
      page,
      latitude: typeof dto.latitude === 'number' ? dto.latitude : undefined,
      longitude: typeof dto.longitude === 'number' ? dto.longitude : undefined,

      groupby: groupsOnPage,
      domain: typeof dto.domain === 'string' ? dto.domain : undefined,
      domainId: typeof dto.domainId === 'number' ? dto.domainId : undefined,
      tbm: typeof dto.tbm === 'string' ? dto.tbm : undefined,
      tbs: typeof dto.tbs === 'string' ? dto.tbs : undefined,
      hl: typeof dto.hl === 'string' ? dto.hl : undefined,
      ads: typeof dto.ads === 'boolean' ? dto.ads : undefined,
      related: typeof dto.related === 'boolean' ? dto.related : undefined,
      video: typeof dto.video === 'boolean' ? dto.video : undefined,
      filter: typeof dto.filter === 'boolean' ? dto.filter : undefined,
      punycode: typeof dto.punycode === 'boolean' ? dto.punycode : undefined,
      hlword: typeof dto.hlword === 'boolean' ? dto.hlword : undefined,
      delayed: typeof dto.delayed === 'boolean' ? dto.delayed : undefined,

      // uule можно принять, но сервис сам сгенерит из lat/lon; пробрасывать не обязательно
      // uule: typeof dto.uule === 'string' ? dto.uule : undefined,
    } as const;

    return { payload, page, groupsOnPage };
  }

  // POST /public/googlelive/:userId/tasks
  @Post('tasks')
  @HttpCode(202)
  async createPost(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateGooglePublicTaskDto,
  ): Promise<{ taskId: number; status: 'pending' }> {
    const { payload } = this.buildCreatePayload(dto);
    try {
      const t = await this.svc.create(userId, payload);
      return { taskId: t.id, status: 'pending' };
    } catch (e) {
      const msg = (e as Error).message ?? '';
      // 200 — закончились деньги
      if (
        msg.includes('insufficient_funds') ||
        msg.includes('payment_required')
      ) {
        this.failJson(200, 'insufficient_funds');
      }
      // 20 — внутренняя ошибка
      this.failJson(20, 'internal_error');
    }
  }

  // GET /public/googlelive/:userId/tasks/create?... (аналог POST)
  @Get('tasks/create')
  @HttpCode(202)
  async createGet(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() dto: CreateGooglePublicTaskDto,
  ): Promise<{ taskId: number; status: 'pending' }> {
    const { payload } = this.buildCreatePayload(dto);
    const t = await this.svc.create(userId, payload);
    return { taskId: t.id, status: 'pending' };
  }

  // GET /public/googlelive/:userId/tasks/:id -> XML (rich)
  @Get('tasks/:id')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async getXml(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<string> {
    try {
      const t = await this.svc.getById(userId, id);

      const groupsOnPage =
        typeof t.groupby === 'number' && t.groupby >= 10 && t.groupby <= 100
          ? t.groupby
          : 100;

      const ctx = { query: t.query, page: t.page ?? 1, groupsOnPage };

      if (t.status === 'ERROR') {
        // здесь можно тоньше мапить (110/111/500 и т.п.) на уровне сервиса;
        return buildYandexXmlError(20, t.error ?? 'internal_error', ctx);
      }

      if (t.status !== 'COMPLETED' || !t.results) {
        return buildYandexXmlPending({ ...ctx, taskId: t.id });
      }

      if (Array.isArray(t.results) && t.results.length === 0) {
        return buildYandexXmlError(15, 'no_results', ctx);
      }

      const extrasObj: Record<string, unknown> | null = t.extras;
      const rqUnknown = getProp(extrasObj, 'relatedQuestions');
      const kgUnknown = getProp(extrasObj, 'knowledgeGraph');

      const pageExtras = {
        relatedQuestions: isStringArray(rqUnknown) ? rqUnknown : null,
        knowledgeGraph: isPlainObject(kgUnknown) ? kgUnknown : null,
      };

      return buildYandexXmlOkRich(t.results, pageExtras, {
        ...ctx,
        totalFound: t.results.length,
      });
    } catch {
      // 121 — bad request id / task not found
      return buildYandexXmlError(121, 'bad_request_id');
    }
  }
}
