// src/modules/public-api/yandexlive.compat.controller.ts
import {
  Controller,
  Get,
  Header,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { YandexLiveService } from './yandexlive.service';
import { PublicApiKeyGuard } from '@/common/guards/public-api-key.guard';
import { UserId } from '@/common/decorators/user-id.decorator';
import { UserRoles } from '@/common/decorators/user-roles.decorator';
import {
  buildYandexXmlError,
  buildYandexXmlOkRich,
  buildYandexXmlPending,
} from './xml/yandex-xml';
import { getProp, isPlainObject, isStringArray } from '@/shared/helpers/guards';
import { ServicesService } from '../services/services.service';
import { ERROR_TEXTS_RU } from './helpers/error-texts.ru';
import { PublicXmlGlobalFilter } from '@/common/filters/public-xml-global.filter';

const tErr = (key: string) => ERROR_TEXTS_RU[key] ?? key;
const SHORT_STATUS_CACHE_ROLE = 'short_status_cache';
const YANDEX_SHORT_STATUS_TTL_MS = 300 * 1000;
const DEFAULT_STATUS_TTL_MS = 86400 * 1000;

function isNonEmptyQuery(q: string | undefined): boolean {
  return typeof q === 'string' && q.trim().length > 0;
}
// function isValidLr(lr: number): boolean {
//   return Number.isInteger(lr) && lr >= 1 && lr <= 99999999;
// }

function isValidYandexGroupby(n: number | undefined): boolean {
  return (
    n === undefined || n === 10 || n === 20 || n === 30 || n === 50 || n === 100
  );
}

function getStatusCacheTtl(roles: string[]): number {
  return roles.includes(SHORT_STATUS_CACHE_ROLE)
    ? YANDEX_SHORT_STATUS_TTL_MS
    : DEFAULT_STATUS_TTL_MS;
}

async function getCachedXml(cache: Cache, key: string): Promise<string | null> {
  try {
    return (await cache.get<string>(key)) ?? null;
  } catch {
    return null;
  }
}

async function setCachedXml(
  cache: Cache,
  key: string,
  xml: string,
  ttl: number,
): Promise<void> {
  try {
    await cache.set(key, xml, ttl);
  } catch {
    // Redis/cache hiccups must not turn a completed SERP task into XML code 20.
  }
}

function normalizeDomainInput(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim().toLowerCase();
  return s.length ? s : undefined;
}

const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
};

class CompatParamsDto {
  @IsString()
  query!: string;

  @IsIn(['desktop', 'mobile'])
  device!: 'desktop' | 'mobile';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  lr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  page?: number;

  // единый параметр “сколько результатов на страницу”
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  groupby?: number;

  // на будущее (принимаем, но прямо здесь не используем)
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

  // совместимость с ?p=
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  p?: number;

  @IsOptional()
  @Transform(({ value }): string | undefined => normalizeDomainInput(value), {
    toClassOnly: true,
  })
  @IsIn(['ru', 'by', 'kz', 'com.tr'])
  domain?: 'ru' | 'by' | 'kz' | 'com.tr';

  @IsOptional()
  @IsString()
  soft_id?: string;
}

class StatusQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() id?: number;
  @IsOptional() @Type(() => Number) @IsInt() task?: number;
  @IsOptional() @Type(() => Number) @IsInt() q?: number;

  get taskId(): number | null {
    return this.id ?? this.task ?? this.q ?? null;
  }
}

function pickInt(obj: unknown, key: string): number | undefined {
  if (
    obj &&
    typeof obj === 'object' &&
    key in (obj as Record<string, unknown>)
  ) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isInteger(v)) return v;
  }
  return undefined;
}

/**
 * GET /public/yandexlive/xml?user=..&key=..&query=..&lr=..&device=..[&page][&groupby]
 * GET /public/yandexlive/xml/status?user=..&key=..&id=123
 */
@UseFilters(PublicXmlGlobalFilter)
@Controller('public/yandexlive')
@UseGuards(PublicApiKeyGuard)
export class YandexLiveCompatController {
  private readonly statusInflight = new Map<string, Promise<string>>();

  constructor(
    private readonly svc: YandexLiveService,
    private readonly services: ServicesService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  @Get('xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async xml(
    @UserId() userId: number,
    @Query() q: CompatParamsDto,
  ): Promise<string> {
    if (!isNonEmptyQuery(q.query)) {
      return buildYandexXmlError(2, tErr('empty_query'), {
        query: q.query,
        page: 1,
      });
    }

    // 2) lr: если не пришёл, берём из service_settings, иначе дефолт 2643
    let effectiveLr: number | undefined = q.lr;

    if (!Number.isInteger(effectiveLr)) {
      const settings = await this.services.getSettingsByCode(
        userId,
        'YANDEX_LIVE',
      );
      const fromSettings = pickInt(settings, 'lr');
      if (Number.isInteger(fromSettings)) effectiveLr = fromSettings;
    }
    if (!Number.isInteger(effectiveLr)) {
      effectiveLr = 172;
    }

    if (!isValidYandexGroupby(q.groupby)) {
      return buildYandexXmlError(102, tErr('invalid_groupby'), {
        query: q.query,
        page: q.page ?? q.p ?? 0,
      });
    }
    // domain ограничен @IsIn, но добавим явный 106 на всякий случай
    if (q.domain && !['ru', 'by', 'kz', 'com.tr'].includes(q.domain)) {
      return buildYandexXmlError(106, tErr('invalid_domain'), {
        query: q.query,
        page: q.page ?? q.p ?? 0,
      });
    }

    const page = q.page ?? q.p ?? 0;

    const softId = typeof q.soft_id === 'string' ? q.soft_id.trim() : undefined;

    try {
      const created = await this.svc.create(userId, {
        query: q.query,
        lr: effectiveLr ?? 172,
        device: q.device,
        page,
        groupby: q.groupby,
        tbm: q.tbm ?? undefined,
        related: q.related,
        punycode: q.punycode,
        hlword: q.hlword,
        delayed: q.delayed,
        domain: q.domain,
        softId,
      });

      return buildYandexXmlPending({
        query: q.query,
        page,
        taskId: created.id,
      });
    } catch (e) {
      const msg = (e as Error).message ?? '';

      // 103 — неверный LR
      if (msg.includes('invalid_lr')) {
        return buildYandexXmlError(103, tErr('invalid_lr'), {
          query: q.query,
          page,
        });
      }

      // 200 — закончились деньги
      if (
        msg.includes('insufficient_funds') ||
        msg.includes('payment_required')
      ) {
        return buildYandexXmlError(200, tErr('insufficient_funds'), {
          query: q.query,
          page,
        });
      }
      // 503 — конвейер перегружен (если сервис кидает queue_overloaded)
      if (
        msg.includes('queue_overloaded') ||
        msg.includes('queue_limit_exceeded')
      ) {
        return buildYandexXmlError(503, tErr('queue_overloaded'), {
          query: q.query,
          page,
        });
      }

      if (msg.includes('engine_blocked')) {
        return buildYandexXmlError(503, tErr('engine_blocked'), {
          query: q.query,
          page,
        });
      }
      // 20 — внутренняя ошибка по умолчанию
      return buildYandexXmlError(20, tErr('internal_error'), {
        query: q.query,
        page,
      });
    }
  }

  @Get('xml/status')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async status(
    @UserId() userId: number,
    @UserRoles() userRoles: string[],
    @Query() q: StatusQueryDto,
  ): Promise<string> {
    const taskId = q.taskId;

    // NEW: корректный «яндекс-код» для невалидного id
    if (!Number.isInteger(taskId)) {
      return buildYandexXmlError(121, tErr('bad_request_id'));
    }
    const cacheKey = `yandexlive:status:${userId}:${taskId}`;
    const cached = await getCachedXml(this.cache, cacheKey);
    if (cached) {
      return cached;
    }

    const inflight = this.statusInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const pending = this.buildStatusXml(
      userId,
      userRoles,
      taskId || 0,
      cacheKey,
    );
    this.statusInflight.set(cacheKey, pending);
    try {
      return await pending;
    } finally {
      this.statusInflight.delete(cacheKey);
    }
  }

  private async buildStatusXml(
    userId: number,
    userRoles: string[],
    taskId: number,
    cacheKey: string,
  ): Promise<string> {
    let t;
    try {
      t = await this.svc.getById(userId, taskId);
    } catch {
      // 121 — не нашли задачу по req_id
      return buildYandexXmlError(121, tErr('bad_request_id'));
    }

    // для XML имеет смысл держать 10 как дефолт для Яндекса (как в твоём сервисе)
    const groupsOnPage = t.groupby ?? 10;
    const ctx = {
      query: t.query,
      page: t.page ?? 0,
      groupsOnPage,
      lr: t.lr,
      device: t.device,
      totalPages: t.totalPages,
      lastPage: t.lastPage,
    };

    if (t.status === 'ERROR') {
      return buildYandexXmlError(500, t.error ?? tErr('internal_error'), ctx);
    }
    if (t.status !== 'COMPLETED' || !t.results) {
      return buildYandexXmlPending({ ...ctx, taskId: t.id });
    }

    // page-level extras (без any/as)
    const extrasObj: Record<string, unknown> | null = t.extras;
    const rqUnknown = getProp(extrasObj, 'relatedQuestions');
    const kgUnknown = getProp(extrasObj, 'knowledgeGraph');

    const relatedQuestions = isStringArray(rqUnknown) ? rqUnknown : null;
    const knowledgeGraph = isPlainObject(kgUnknown) ? kgUnknown : null;

    const xml = buildYandexXmlOkRich(
      t.results,
      { relatedQuestions, knowledgeGraph },
      { ...ctx, totalFound: t.results.length },
    );

    const ttl = getStatusCacheTtl(userRoles);
    await setCachedXml(this.cache, cacheKey, xml, ttl);

    // совместимость с одноразовой выдачей
    void this.svc.deleteById(userId, t.id).catch(() => void 0);

    return xml;
  }
}
