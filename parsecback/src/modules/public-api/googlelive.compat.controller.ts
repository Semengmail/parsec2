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
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { GoogleLiveService } from './googlelive.service';
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
const GOOGLE_SHORT_STATUS_TTL_MS = 500 * 1000;
const DEFAULT_STATUS_TTL_MS = 86400 * 1000;

function isValidGoogleGroupby(n: number | undefined): boolean {
  return n === 10 || n === 20 || n === 30 || n === 50 || n === 100;
}

function isNonEmptyQuery(q: string | undefined): boolean {
  return typeof q === 'string' && q.trim().length > 0;
}

function isValidLr(lr: number): boolean {
  // пример: разрешим 1..99999999 (или свой список регионов, если есть)
  return Number.isInteger(lr) && lr >= 1 && lr <= 9999999999;
}

function isValidDomainString(s: string | undefined): boolean {
  if (!s) return true; // опционально
  // у вас уже есть @Matches, но здесь сделаем явный возврат кода 106
  return /^(\d+|[a-z]{2,}(?:\.[a-z]{2,})*)$/.test(s.trim().toLowerCase());
}

function getStatusCacheTtl(roles: string[]): number {
  return roles.includes(SHORT_STATUS_CACHE_ROLE)
    ? GOOGLE_SHORT_STATUS_TTL_MS
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

// Без unsafe String(..) для unknown
const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
};

// безопасный нормалайзер домена: число/булево → строка, мусор → undefined
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

/** входные параметры (page и/или rank, + новые опции; все опционально) */
class CompatParamsDto {
  @IsString() query!: string;

  @IsIn(['desktop', 'mobile']) device!: 'desktop' | 'mobile';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  lr?: number;

  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;

  // пагинация / приоритет ранга
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) rank?: number;

  // дополнительные опции (пока не пробрасываем в сервис, но валидируем)
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
  @IsOptional() @IsString() gl?: string;
  @IsOptional() @IsString() uule?: string;

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
 * GET /public/googlelive/xml?user..&key..&query..&lr..&device..[&page|&rank]
 * GET /public/googlelive/xml/status?user..&key..&id=...
 */
@UseFilters(PublicXmlGlobalFilter)
@Controller('public/googlelive')
@UseGuards(PublicApiKeyGuard)
export class GoogleLiveCompatController {
  private readonly statusInflight = new Map<string, Promise<string>>();

  constructor(
    private readonly svc: GoogleLiveService,
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
    const groupsOnPage = isValidGoogleGroupby(q.groupby ?? 10)
      ? (q.groupby ?? 10)
      : 10;

    // page из rank (ceil(rank / groupby)) — если rank есть, он приоритетнее
    const pageFromRank = q.rank
      ? Math.max(0, Math.ceil(q.rank / groupsOnPage))
      : undefined;
    const page = pageFromRank ?? q.page ?? 0;

    // 2) lr: если не пришёл, берём из service_settings, иначе дефолт 2643
    let effectiveLr: number | undefined = q.lr;

    if (!Number.isInteger(effectiveLr)) {
      const settings = await this.services.getSettingsByCode(
        userId,
        'GOOGLE_LIVE',
      );
      const fromSettings = pickInt(settings, 'lr');
      if (Number.isInteger(fromSettings)) effectiveLr = fromSettings;
    }
    if (!Number.isInteger(effectiveLr)) {
      effectiveLr = 2643; // дефолт для Google
    }

    // валидация lr после финального определения
    if (!isValidLr(effectiveLr!)) {
      return buildYandexXmlError(103, tErr('invalid_lr'), {
        query: q.query,
        page,
      });
    }

    const softId = typeof q.soft_id === 'string' ? q.soft_id.trim() : undefined;

    // передаём в сервис ТОЛЬКО поддерживаемые сейчас поля (без any)
    const payload = {
      query: q.query,
      lr: effectiveLr ?? 2643,
      device: q.device,
      page,
      latitude: typeof q.latitude === 'number' ? q.latitude : undefined,
      longitude: typeof q.longitude === 'number' ? q.longitude : undefined,

      // новые поля:
      groupby: groupsOnPage,
      domain: typeof q.domain === 'string' ? q.domain : undefined,
      domainId: typeof q.domainId === 'number' ? q.domainId : undefined,
      tbm: typeof q.tbm === 'string' ? q.tbm : undefined,
      tbs: typeof q.tbs === 'string' ? q.tbs : undefined,
      hl: typeof q.hl === 'string' ? q.hl : undefined,
      gl: typeof q.hl === 'string' ? q.hl : undefined,
      ads: typeof q.ads === 'boolean' ? q.ads : undefined,
      related: typeof q.related === 'boolean' ? q.related : undefined,
      video: typeof q.video === 'boolean' ? q.video : undefined,
      filter: typeof q.filter === 'boolean' ? q.filter : undefined,
      punycode: typeof q.punycode === 'boolean' ? q.punycode : undefined,
      hlword: typeof q.hlword === 'boolean' ? q.hlword : undefined,
      delayed: typeof q.delayed === 'boolean' ? q.delayed : undefined,

      softId,
    } as const;

    // 2 — пустой запрос
    if (!isNonEmptyQuery(q.query)) {
      return buildYandexXmlError(2, tErr('empty_query'), {
        query: q.query,
        page: 0,
      });
    }

    // 102 — неправильный groupby для Google
    if (!isValidGoogleGroupby(groupsOnPage)) {
      return buildYandexXmlError(102, tErr('invalid_groupby'), {
        query: q.query,
        page: q.page ?? 0,
      });
    }

    // 106 — неверный domain
    if (!isValidDomainString(q.domain)) {
      return buildYandexXmlError(106, tErr('invalid_domain'), {
        query: q.query,
        page: q.page ?? 0,
      });
    }

    let created;
    try {
      created = await this.svc.create(userId, payload);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      // 200 — закончились деньги (сервис бросает PAYMENT_REQUIRED/insufficient_funds)
      if (
        msg.includes('insufficient_funds') ||
        msg.includes('payment_required')
      ) {
        return buildYandexXmlError(200, tErr('insufficient_funds'), {
          query: q.query,
          page,
        });
      }
      if (msg.includes('bad_api_key')) {
        return buildYandexXmlError(200, tErr('bad_api_key'), {
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
      if (
        msg.includes('queue_limit_exceeded') ||
        msg.includes('queue_overloaded')
      ) {
        return buildYandexXmlError(503, tErr('queue_overloaded'), {
          query: q.query,
          page,
        });
      }
      // 20–24 — внутренняя ошибка (оставим одним кодом 20)
      return buildYandexXmlError(20, tErr('internal_error'), {
        query: q.query,
        page,
      });
    }

    return buildYandexXmlPending({
      query: q.query,
      page,
      taskId: created.id,
    });
  }

  @Get('xml/status')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async status(
    @UserId() userId: number,
    @UserRoles() userRoles: string[],
    @Query() q: StatusQueryDto,
  ): Promise<string> {
    const taskId = q.taskId;
    if (!Number.isInteger(taskId)) {
      // 121 — bad request id
      return buildYandexXmlError(121, tErr('bad_request_id'));
    }

    const cacheKey = `googlelive:status:${userId}:${taskId}`;
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

    // по-хорошему groupsOnPage брать из t.groupby; пока дефолт 100 (или 30 — как решил)
    const groupsOnPage = t.groupby ?? 100;
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
      // pending как есть
      return buildYandexXmlPending({ ...ctx, taskId: t.id });
    }

    if (Array.isArray(t.results) && t.results.length === 0) {
      return buildYandexXmlError(15, tErr('no_results'), ctx);
    }

    const extrasObj: Record<string, unknown> | null = t.extras;

    const rqUnknown = getProp(extrasObj, 'relatedQuestions');
    const kgUnknown = getProp(extrasObj, 'knowledgeGraph');

    const relatedQuestions = isStringArray(rqUnknown) ? rqUnknown : null;
    const knowledgeGraph = isPlainObject(kgUnknown) ? kgUnknown : null;

    const pageExtras = { relatedQuestions, knowledgeGraph };

    const xml = buildYandexXmlOkRich(t.results, pageExtras, {
      ...ctx,
      totalFound: t.results.length,
    });

    const ttl = getStatusCacheTtl(userRoles);
    await setCachedXml(this.cache, cacheKey, xml, ttl);

    // совместимость с ожиданием одноразовой выдачи
    void this.svc.deleteById(userId, t.id).catch(() => void 0);
    return xml;
  }
}
