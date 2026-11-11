// src/modules/public-api/googlelive.service.ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as ExcelJS from 'exceljs';

import {
  GoogleLiveTask,
  SerpResultExtras,
  SerpResultItem,
} from './entities/googlelive-task.entity';
import { RankScanClient, RSResult } from './rankscan.client';
import { BillingService } from '@/modules/billing/billing.service';
import {
  pickRows,
  extractIds,
  toPickForSend,
  type PickForSend,
  isTransientError,
  calcNextDelayMs,
} from './helpers/pollSent';
import { GoogleCityCoords } from './entities/google-city-coords';
import { generateUuleA, generateUuleW } from './utils/uule';
import { normalizeGoogleDomain } from './utils/google-domain';
import { GoogleGeoTarget } from './entities/google-geo-target.entity';
import { LimitsService } from '@/common/limits/limits.service';
import { TaskStatsService } from '../task-stats/task-stats.service';
import { GOOGLELIVE_ERROR_TEXTS } from './helpers/googlelive-errors.ru';
import { EngineBlockService } from './engine-block.service';
import { getRankScanThroughput } from './helpers/rankscan-throughput';

const ERR = {
  EMPTY_QUERY: 'empty_query',
  INVALID_LR: 'invalid_lr',
  INVALID_DEVICE: 'invalid_device',
  INVALID_GROUPBY: 'invalid_groupby',
  INVALID_DOMAIN: 'invalid_domain',
  QUEUE_OVERLOADED: 'queue_overloaded',
  MISSING_EXTERNAL_ID: 'missing_externalTaskId',
  TRANSIENT_FETCH_FAILED: 'transient_fetch_failed',
  BAD_PARAMS: 'bad_params',
  RATE_LIMITED: 'rate_limited',
  QUOTA_EXCEEDED: 'quota_exceeded',
  REMOTE_ERROR: 'remote_error',
} as const;

type ErrorReason = (typeof ERR)[keyof typeof ERR];
type RSPending = { status: 'pending' };
type RSNotFound = { status: 'not_found' };
type RSError = { status: 'error'; message?: string };
type RSCompleted = {
  status: 'completed';
  results: RSResult[];
  relatedQuestions?: string[] | null;
  knowledgeGraph?: Record<string, unknown> | null;
  pageMeta?: unknown; // если нужно — замени на свой тип
  processedPages?: number;
  pagesByServer?: Record<string, number>;
};
type RSGetTask = RSPending | RSNotFound | RSError | RSCompleted;

const GEO_CACHE_PREFIX = 'google:geotarget:';
const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
type GeoCityLookup = {
  cityName: string;
  fullCityName: string;
  country: string | null;
};

export type PushQueuedOptions = {
  onlyUserId?: number | null;
};

export function mapRsToSerpItems(rs: RSResult[]): SerpResultItem[] {
  return rs.map((r) => {
    const extras: SerpResultExtras = {
      pubDate: r.pubDate ?? null,
      passages: r.passages ?? null,
      sitelinks: r.sitelinks
        ? r.sitelinks.map((s) => ({
            title: s.title ?? null,
            url: s.url ?? null,
            snippet: s.snippet ?? null,
          }))
        : null,
      onelineSitelinks: r.onelineSitelinks
        ? r.onelineSitelinks.map((s) => ({
            title: s.title ?? null,
            url: s.url ?? null,
            snippet: s.snippet ?? null,
          }))
        : null,
      featuredSnippet: r.isFeaturedSnippet
        ? {
            text: r.extendedPassage ?? undefined,
            url: r.url ?? undefined,
            title: r.title ?? undefined,
          }
        : undefined,
    };

    return {
      position: r.position,
      url: r.url,
      site: r.site ?? null,
      title: r.title ?? null,
      extras,
    };
  });
}

/** загрузка по устройствам среди SENDING|SENT|POLLING */
const SQL_COUNT_INFLIGHT_BY_DEVICE = `
  SELECT device, COUNT(*)::int AS count
  FROM public_googlelive_tasks
  WHERE status IN ('SENDING','SENT','POLLING')
  GROUP BY device;
`;

/**
 * Round-robin отбор ТОЛЬКО по указанному устройству:
 * берём сначала по 1 задаче на пользователя (ORDER BY createdAt,id),
 * затем по 2-й и т.д., блокируем и переводим в SENDING.
 * $1 = limit, $2 = device ('desktop' | 'mobile')
 */
const SQL_PICK_RR_TO_SENDING_BY_DEVICE = `
WITH active_by_user AS (
  SELECT "userId", COUNT(*)::int AS active_count
  FROM public_googlelive_tasks
  WHERE status IN ('SENDING','SENT','POLLING')
  GROUP BY "userId"
),
queued AS (
  SELECT
    t.id,
    t."userId",
    t."createdAt",
    COALESCE(a.active_count, 0) AS active_count,
    CASE WHEN 'admin' = ANY(COALESCE(u.role, ARRAY[]::text[])) THEN $5::int ELSE $4::int END AS user_cap,
    ROW_NUMBER() OVER (PARTITION BY t."userId" ORDER BY t."createdAt", t.id) AS rn
  FROM public_googlelive_tasks
  t
  JOIN users u ON u.id = t."userId"
  LEFT JOIN active_by_user a ON a."userId" = t."userId"
  WHERE t.status = 'QUEUED'
    AND t.device = $2
    AND (t."nextPollAt" IS NULL OR t."nextPollAt" <= now())
    AND ($3::int IS NULL OR t."userId" = $3)
),
ordered AS (
  SELECT id
  FROM queued
  WHERE rn <= GREATEST(0, user_cap - active_count)
  ORDER BY rn, "userId", id
  LIMIT $1
),
locked AS (
  SELECT t.id
  FROM public_googlelive_tasks t
  JOIN ordered o ON o.id = t.id
  FOR UPDATE SKIP LOCKED
)
UPDATE public_googlelive_tasks t
SET status = 'SENDING', "updatedAt" = now()
FROM locked
WHERE t.id = locked.id
RETURNING
  t.id,
  t."userId"          AS "userId",
  t.query             AS "query",
  t.lr                AS "lr",
  t.device            AS "device",
  COALESCE(t.page, 1) AS "page",
  t.latitude          AS "latitude",
  t.longitude         AS "longitude",
  t.uule              AS "uule",
  t."externalTaskId"  AS "externalTaskId",
  t.status            AS "status";
`;

const SQL_POLL = `
WITH pick AS (
  SELECT id
  FROM public_googlelive_tasks
  WHERE status = 'SENT'
    AND ("nextPollAt" IS NULL OR "nextPollAt" <= now())
  ORDER BY "createdAt", id
  FOR UPDATE SKIP LOCKED
  LIMIT $1
)
UPDATE public_googlelive_tasks t
SET status = 'POLLING', "updatedAt" = now()
FROM pick
WHERE t.id = pick.id
RETURNING
  t.id,
  t."userId"          AS "userId",
  t.query             AS "query",
  t.lr                AS "lr",
  t.device            AS "device",
  COALESCE(t.page, 1) AS "page",
  t.latitude          AS "latitude",
  t.longitude         AS "longitude",
  t.uule              AS "uule",
  t."externalTaskId"  AS "externalTaskId",
  t.status            AS "status";
`;

const SERVICE_CODE = 'GOOGLE_LIVE' as const;

// «размазываем» старт выбранных задач по окну времени
const PACE_WINDOW_MS = 1700;
const MIN_INTERVAL_MS = 20;
const MAX_INTERVAL_MS = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const INITIAL_POLL_DELAY_MS = 2000;
const INITIAL_POLL_JITTER_MS = 3000;
const STALE_SENDING_MS = 2 * 60 * 1000;
const STALE_POLLING_MS = 2 * 60 * 1000;
const POLL_CONCURRENCY = 10;

// Сколько задач у Yandex сейчас "в работе"
const SQL_COUNT_INFLIGHT_TOTAL_YANDEX = `
  SELECT COUNT(*)::int AS count
  FROM public_yandexlive_tasks
  WHERE status IN ('SENDING','SENT','POLLING');
`;

const MAX_TRANSIENT_RETRIES = 10;

// Cache
const COORDS_CACHE_PREFIX = 'google:coords:';

const XLSX_CACHE_KEY = 'google:cities:xlsx:v1';
const XLSX_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

type Coords = { lat: number; lon: number; cityName: string };

type CreateGoogleTaskPayload = {
  query: string;
  lr: number;
  device: 'desktop' | 'mobile';
  page?: number;
  latitude?: number;
  longitude?: number;

  groupby?: number;
  domain?: string;
  domainId?: number;
  tbm?: '' | 'images' | 'video';
  tbs?: '' | 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y';
  hl?: string;
  gl?: string;
  ads?: boolean;
  related?: boolean;
  video?: boolean;
  filter?: boolean;
  punycode?: boolean;
  hlword?: boolean;
  delayed?: boolean;

  softId?: string;
};

const clampInt = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i < min || i > max ? null : i;
};

@Injectable()
export class GoogleLiveService {
  private readonly log = new Logger(GoogleLiveService.name);

  /** максимально допустимое количество задач «в работе» (SENDING|SENT|POLLING) */
  private static readonly MAX_IN_FLIGHT = 100;

  constructor(
    @InjectRepository(GoogleLiveTask)
    private readonly repo: Repository<GoogleLiveTask>,
    @InjectRepository(GoogleCityCoords)
    private readonly cityRepo: Repository<GoogleCityCoords>,
    @InjectRepository(GoogleGeoTarget)
    private readonly geoRepo: Repository<GoogleGeoTarget>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly rs: RankScanClient,
    private readonly ds: DataSource,
    private readonly billing: BillingService,
    private readonly limits: LimitsService,
    private readonly taskStats: TaskStatsService,
    private readonly engineBlock: EngineBlockService,
  ) {}

  private validateCreateInput(dto: CreateGoogleTaskPayload): void {
    if (!dto?.query || !String(dto.query).trim()) {
      throw new HttpException(
        GOOGLELIVE_ERROR_TEXTS.empty_query,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!Number.isInteger(dto.lr) || dto.lr < 1 || dto.lr > 99_999_999) {
      throw new HttpException(
        GOOGLELIVE_ERROR_TEXTS.invalid_lr,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (dto.device !== 'desktop' && dto.device !== 'mobile') {
      throw new HttpException(
        GOOGLELIVE_ERROR_TEXTS.invalid_device,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (dto.groupby != null) {
      const g = Math.trunc(Number(dto.groupby));
      const ok = g === 10 || g === 20 || g === 30 || g === 50 || g === 100;
      if (!ok) {
        throw new HttpException(
          GOOGLELIVE_ERROR_TEXTS.invalid_groupby,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
    if (dto.domain) {
      const s = String(dto.domain).trim().toLowerCase();
      const re = /^(\d+|[a-z]{2,}(?:\.[a-z]{2,})*)$/;
      if (!re.test(s)) {
        throw new HttpException(
          GOOGLELIVE_ERROR_TEXTS.invalid_domain,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
  }

  // утилита – текущая занятость моего конвейера с учётом “соседа” (Yandex)
  private async getMyFreeCapacity(): Promise<number> {
    const { total: inTotal } = await this.getInFlightByDevice();
    const otherInFlight = await this.getOtherEngineInFlightTotal();

    const globalCap = await this.limits.getGlobalMaxInFlight();
    const fairCap = otherInFlight > 0 ? Math.floor(globalCap / 2) : globalCap;
    const hardCap = Math.max(0, globalCap - otherInFlight);
    const myMax = Math.min(fairCap, hardCap);

    return Math.max(0, myMax - inTotal);
  }

  private classifyCreateError(e: unknown): {
    transient: boolean;
    reason: ErrorReason;
    retryMs?: number;
  } {
    const msg = (e as Error)?.message?.toLowerCase() || '';

    // любые сетевые проблемы — transient
    if (
      msg.includes('fetch failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('connect') ||
      msg.includes('ecconnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('socket') ||
      msg.includes('network') ||
      msg.includes('unreachable') ||
      msg.includes('timeout') ||
      msg.includes('rank-scan create 5') ||
      msg.includes('bad gateway') ||
      msg.includes('service unavailable') ||
      msg.includes('gateway timeout') ||
      msg.includes('internal server error')
    ) {
      return {
        transient: true,
        reason: ERR.TRANSIENT_FETCH_FAILED,
        retryMs: 3000 + Math.floor(Math.random() * 3000),
      };
    }

    // 429
    if (msg.includes('rate') && msg.includes('limit')) {
      return { transient: true, reason: ERR.RATE_LIMITED, retryMs: 4000 };
    }

    // мягкие/сетевые/429:
    if (msg.includes('timeout') || msg.includes('etimedout')) {
      return {
        transient: true,
        reason: ERR.TRANSIENT_FETCH_FAILED,
        retryMs: 3000,
      };
    }
    if (msg.includes('rate') && msg.includes('limit')) {
      return { transient: true, reason: ERR.RATE_LIMITED, retryMs: 4000 };
    }
    if (msg.includes('quota') || msg.includes('too many')) {
      return { transient: true, reason: ERR.QUOTA_EXCEEDED, retryMs: 5000 };
    }
    // неверные параметры
    if (msg.includes('invalid') || msg.includes('bad request')) {
      return { transient: false, reason: ERR.BAD_PARAMS };
    }
    // по умолчанию считаем фатальной
    return { transient: false, reason: ERR.REMOTE_ERROR };
  }

  private calcInitialPollAt(): Date {
    return new Date(
      Date.now() +
        INITIAL_POLL_DELAY_MS +
        Math.floor(Math.random() * INITIAL_POLL_JITTER_MS),
    );
  }

  private async resolveCoords(lr: number): Promise<Coords | null> {
    const key = COORDS_CACHE_PREFIX + String(lr);

    // 1) пробуем кеш
    try {
      const cached = await this.cache.get<Coords | 'nil'>(key);
      if (cached !== undefined) {
        return cached === 'nil' ? null : cached;
      }
    } catch (e) {
      this.log.warn(`coords cache get failed: ${(e as Error).message}`);
    }

    // 2) идём в БД
    const raw: unknown = await this.ds.query(
      `SELECT latitude, longitude, name AS "cityName"
        FROM google_city_coords
        WHERE lr = $1
        LIMIT 1;`,
      [String(lr)],
    );

    const rows = pickRows(raw);
    const r0 = rows[0] as
      | { latitude?: unknown; longitude?: unknown; cityName?: unknown }
      | undefined;

    let value: Coords | null = null;
    if (r0) {
      const lat =
        typeof r0.latitude === 'number' ? r0.latitude : Number(r0.latitude);
      const lon =
        typeof r0.longitude === 'number' ? r0.longitude : Number(r0.longitude);

      const cityName =
        typeof r0.cityName === 'string' ? r0.cityName : String(r0.cityName);

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        value = { lat, lon, cityName };
      }
    }

    // 3) сохраняем в кеш (кэшируем и промах как 'nil')
    try {
      await this.cache.set(key, value ?? 'nil', XLSX_CACHE_TTL_MS);
    } catch (e) {
      this.log.warn(`coords cache set failed: ${(e as Error).message}`);
    }

    return value;
  }

  private async getOtherEngineInFlightTotal(): Promise<number> {
    const raw: unknown = await this.ds.query(SQL_COUNT_INFLIGHT_TOTAL_YANDEX);
    const rows = pickRows(raw);
    const v = (rows[0] as { count?: unknown })?.count;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private async recoverStaleSending(): Promise<void> {
    const raw: unknown = await this.ds.query(
      `
      UPDATE public_googlelive_tasks
      SET status = 'QUEUED',
          "externalTaskId" = NULL,
          error = 'recovered_stale_sending',
          "updatedAt" = now()
      WHERE status = 'SENDING'
        AND "updatedAt" < now() - ($1::int * interval '1 millisecond')
      RETURNING id;
      `,
      [STALE_SENDING_MS],
    );
    const count = pickRows(raw).length;
    if (count > 0) {
      this.log.warn(`recovered ${count} stale SENDING tasks`);
    }
  }

  private async recoverStalePolling(): Promise<void> {
    const raw: unknown = await this.ds.query(
      `
      UPDATE public_googlelive_tasks
      SET status = 'SENT',
          error = 'recovered_stale_polling',
          "nextPollAt" = now(),
          "updatedAt" = now()
      WHERE status = 'POLLING'
        AND "updatedAt" < now() - ($1::int * interval '1 millisecond')
      RETURNING id;
      `,
      [STALE_POLLING_MS],
    );
    const count = pickRows(raw).length;
    if (count > 0) {
      this.log.warn(`recovered ${count} stale POLLING tasks`);
    }
  }

  /**
   * Возвращает данные города по Google LR (criteria_id) с кешированием.
   * Поля: name -> cityName, canonical_name -> fullCityName, country_code -> country
   */
  private async getCityByGoogleLr(
    googleLr: number,
  ): Promise<GeoCityLookup | null> {
    if (!Number.isInteger(googleLr) || googleLr <= 0) return null;

    const key = GEO_CACHE_PREFIX + String(googleLr);

    // 1) пробуем кеш
    try {
      const cached = await this.cache.get<GeoCityLookup | 'nil'>(key);
      if (cached !== undefined) {
        return cached === 'nil' ? null : cached;
      }
    } catch (e) {
      this.log?.warn?.(`geo cache get failed: ${(e as Error).message}`);
    }

    // 2) берём из БД (по criteria_id)
    const row = await this.geoRepo.findOne({
      where: { criteriaId: googleLr },
      select: ['name', 'canonicalName', 'countryCode'],
    });

    const value: GeoCityLookup | null = row
      ? {
          cityName: row.name,
          fullCityName: row.canonicalName,
          country: row.countryCode,
        }
      : null;

    try {
      await this.cache.set(key, value ?? 'nil', GEO_CACHE_TTL_MS);
    } catch (e) {
      this.log?.warn?.(`geo cache set failed: ${(e as Error).message}`);
    }

    return value;
  }

  async create(
    userId: number,
    dto: CreateGoogleTaskPayload,
  ): Promise<GoogleLiveTask> {
    this.validateCreateInput(dto);

    if (await this.engineBlock.isEngineBlocked('google')) {
      throw new Error('engine_blocked');
    }
    const maxQueued = await this.limits.getMaxQueuedPerEngine();

    const queuedCount = await this.repo.count({
      where: {
        status: 'QUEUED',
      },
    });

    if (queuedCount >= maxQueued) {
      throw new HttpException(
        'queue_limit_exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const pre = await this.billing.precheckFunds(userId, SERVICE_CODE, 1);
    if (!pre.ok) {
      throw new HttpException(
        'insufficient_funds',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // const free = await this.getMyFreeCapacity();
    // if (free <= 0) {
    //   throw new HttpException(
    //     ERR.QUEUE_OVERLOADED,
    //     HttpStatus.SERVICE_UNAVAILABLE,
    //   );
    // }

    // 1) Тянем координаты/город по LR один раз
    const coords = await this.resolveCoords(dto.lr);
    const geo = await this.getCityByGoogleLr(dto.lr);

    // 2) Выбираем lat/lon, отдавая приоритет явным значениям dto
    const lat: number | null = Number.isFinite(dto.latitude)
      ? (dto.latitude as number)
      : Number.isFinite(coords?.lat)
        ? coords!.lat
        : null;

    const lon: number | null = Number.isFinite(dto.longitude)
      ? (dto.longitude as number)
      : Number.isFinite(coords?.lon)
        ? coords!.lon
        : null;

    // 3) Генерируем UULE: сперва w+ по названию города, потом a+ по координатам
    let uule: string | null = null;

    const cityFullName = geo?.fullCityName ?? coords?.cityName ?? null;

    if (cityFullName) {
      try {
        uule = generateUuleW(cityFullName); // UTF-8, транслит не нужен
      } catch (e) {
        this.log.warn(
          `UULE w+ failed for "${cityFullName}": ${(e as Error).message}`,
        );
      }
    }
    if (!uule && Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        uule = generateUuleA(lat as number, lon as number);
      } catch (e) {
        this.log.warn(`UULE a+ failed: ${(e as Error).message}`);
      }
    }

    const pageSafe = clampInt(dto?.page, 0, 10) ?? 0;
    const groupbySafe = clampInt(dto?.groupby, 10, 100);

    const { domain, domainId } = normalizeGoogleDomain(
      dto.domain,
      dto.domainId,
    );

    const glSafe =
      typeof dto.gl === 'string' && /^[A-Za-z]{2}$/.test(dto.gl)
        ? dto.gl.toUpperCase()
        : null;

    const t = this.repo.create({
      userId,
      query: dto.query,
      lr: dto.lr,
      device: dto.device,
      page: pageSafe,

      // сохраняем то, что получилось
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lon) ? lon : null,
      uule,
      cityName: geo?.cityName ?? coords?.cityName ?? null,

      // расширенные опции
      groupby: groupbySafe,
      domain,
      domainId,
      tbm: dto.tbm ?? null,
      tbs: dto.tbs ?? null,
      hl: dto.hl ?? null,
      gl: glSafe ?? geo?.country ?? null,
      ads: typeof dto.ads === 'boolean' ? dto.ads : null,
      related: typeof dto.related === 'boolean' ? dto.related : null,
      video: typeof dto.video === 'boolean' ? dto.video : null,
      filter: typeof dto.filter === 'boolean' ? dto.filter : null,
      punycode: typeof dto.punycode === 'boolean' ? dto.punycode : null,
      hlword: typeof dto.hlword === 'boolean' ? dto.hlword : null,
      delayed: typeof dto.delayed === 'boolean' ? dto.delayed : null,

      softId: dto.softId ?? null,

      status: 'QUEUED',
      externalTaskId: null,
      error: null,
      results: null,
      completedAt: null,
    });
    return this.repo.save(t);
  }

  async findLatestByParams(input: {
    userId: number;
    query: string;
    lr: number;
    device: 'desktop' | 'mobile';
  }): Promise<GoogleLiveTask | null> {
    return this.repo.findOne({
      where: {
        userId: input.userId,
        query: input.query,
        lr: input.lr,
        device: input.device,
        page: 1,
      },
      order: { id: 'DESC' },
    });
  }

  /** Узнаём текущую «в работу» загрузку по устройствам. */
  private async getInFlightByDevice(): Promise<{
    desktop: number;
    mobile: number;
    total: number;
  }> {
    const raw: unknown = await this.ds.query(SQL_COUNT_INFLIGHT_BY_DEVICE);
    const rows = pickRows(raw);
    let desktop = 0;
    let mobile = 0;
    for (const r of rows) {
      const dev = (r as { device?: unknown })?.device;
      const cntRaw = (r as { count?: unknown })?.count;
      const cnt = typeof cntRaw === 'number' ? cntRaw : Number(cntRaw ?? 0);
      if (dev === 'desktop') desktop = Number.isFinite(cnt) ? cnt : 0;
      else if (dev === 'mobile') mobile = Number.isFinite(cnt) ? cnt : 0;
    }
    return { desktop, mobile, total: desktop + mobile };
  }

  /** fair push с лимитом конвейера и квотами по устройствам (1 : 1.5) */
  async pushQueued(tickCap = 50, opts?: PushQueuedOptions): Promise<number> {
    const onlyUserId = opts?.onlyUserId ?? null;
    await this.recoverStaleSending();

    // 1) свободная ёмкость
    const {
      desktop: inD,
      mobile: inM,
      total: inTotal,
    } = await this.getInFlightByDevice();
    const otherInFlight = await this.getOtherEngineInFlightTotal();

    const globalCap = await this.limits.getGlobalMaxInFlight();
    const settings = await this.limits.getSettings();
    const userLimit = settings.services.googleLive.userRequestLimit;
    const adminLimit = settings.services.googleLive.adminRequestLimit;

    const ratio = this.limits.getDeviceRatio();
    const ratioSum = ratio.desktop + ratio.mobile;

    const fairCap = otherInFlight > 0 ? Math.floor(globalCap / 2) : globalCap;
    const hardCap = Math.max(0, globalCap - otherInFlight);
    const myMax = Math.min(fairCap, hardCap);

    const free = Math.max(0, myMax - inTotal);

    if (free <= 0) {
      return 0;
    }
    const toTake = Math.min(tickCap, free);

    // 2) целевое распределение после добора
    const targetTotal = inTotal + toTake;

    const targetDesktop = Math.round((targetTotal * ratio.desktop) / ratioSum);
    const targetMobile = targetTotal - targetDesktop;

    const needD = Math.max(0, targetDesktop - inD);
    const needM = Math.max(0, targetMobile - inM);
    const quotaD = Math.min(needD, toTake);
    const quotaM = Math.min(needM, Math.max(0, toTake - quotaD));

    // 3) первый проход по квотам
    const rawD1: unknown = quotaD
      ? await this.ds.query(SQL_PICK_RR_TO_SENDING_BY_DEVICE, [
          quotaD,
          'desktop',
          onlyUserId,
          userLimit,
          adminLimit,
        ])
      : [];
    const rawM1: unknown = quotaM
      ? await this.ds.query(SQL_PICK_RR_TO_SENDING_BY_DEVICE, [
          quotaM,
          'mobile',
          onlyUserId,
          userLimit,
          adminLimit,
        ])
      : [];

    let pickedRaw = [...pickRows(rawD1), ...pickRows(rawM1)];
    let pickedCount = pickedRaw.length;

    // 4) добор, если недотянули
    let remainder = toTake - pickedCount;
    if (remainder > 0) {
      const gotD = pickRows(rawD1).length;
      const gotM = pickRows(rawM1).length;
      const afterD = inD + gotD;
      const afterM = inM + gotM;

      const deficitD = Math.max(0, targetDesktop - afterD);
      const deficitM = Math.max(0, targetMobile - afterM);
      const order: ('desktop' | 'mobile')[] =
        deficitD >= deficitM ? ['desktop', 'mobile'] : ['mobile', 'desktop'];

      for (const dev of order) {
        if (remainder <= 0) break;
        const rawExtra: unknown = await this.ds.query(
          SQL_PICK_RR_TO_SENDING_BY_DEVICE,
          [remainder, dev, onlyUserId, userLimit, adminLimit],
        );
        const rows = pickRows(rawExtra);
        if (rows.length > 0) {
          pickedRaw = [...pickedRaw, ...rows];
          remainder -= rows.length;
        }
      }
      pickedCount = pickedRaw.length;
    }

    // 5) маппинг
    const list = pickedRaw
      .map(toPickForSend)
      .filter((v): v is PickForSend => v !== null);

    if (pickedRaw.length > 0 && list.length === 0) {
      const ids = extractIds(pickedRaw);
      if (ids.length > 0) {
        await this.repo.update({ id: In(ids) }, { status: 'QUEUED' });
        this.log.warn(
          `pushQueued: reverted ${ids.length} back to QUEUED (mapping failed)`,
        );
      }
    }

    // 6) пейсинг стартов
    const intervalMs =
      list.length > 1
        ? Math.max(
            MIN_INTERVAL_MS,
            Math.min(MAX_INTERVAL_MS, Math.floor(PACE_WINDOW_MS / list.length)),
          )
        : 0;

    // 7) отправка во внешний сервис
    let sent = 0;
    for (const [i, t] of list.entries()) {
      if (i > 0 && intervalMs > 0) await sleep(intervalMs);
      const full = await this.repo.findOne({
        where: { id: t.id },
        select: [
          'groupby',
          'domain',
          'domainId',
          'tbm',
          'tbs',
          'hl',
          'gl',
          'ads',
          'related',
          'video',
          'filter',
          'punycode',
          'hlword',
          'delayed',
          'latitude',
          'longitude',
          'uule',
          'cityName',
        ],
      });

      try {
        this.log.log(`PUSH: #${t.id} "${t.query}" lr=${t.lr} dev=${t.device}`);
        const cityName: string | undefined =
          typeof (full?.cityName ?? t.cityName) === 'string'
            ? (full?.cityName ?? t.cityName)!
            : undefined;

        const created = await this.rs.createTask({
          query: t.query,
          device: t.device,
          lr: t.lr,
          searchEngine: 'google',
          page: t.page ?? 1,
          latitude: full?.latitude ?? t.latitude ?? undefined,
          longitude: full?.longitude ?? t.longitude ?? undefined,
          uule: full?.uule ?? t.uule ?? undefined,
          cityName,

          // пробрасываем опции
          groupby:
            full?.groupby && full.groupby >= 10 && full.groupby <= 100
              ? full.groupby
              : undefined,
          domain: full?.domain || undefined,
          domainId: full?.domainId ?? undefined,
          tbm: full?.tbm ?? undefined,
          tbs: full?.tbs ?? undefined,
          hl: full?.hl ?? undefined,
          gl: full?.gl ?? undefined,
          ads: typeof full?.ads === 'boolean' ? full?.ads : undefined,
          related:
            typeof full?.related === 'boolean' ? full?.related : undefined,
          video: typeof full?.video === 'boolean' ? full?.video : undefined,
          filter: typeof full?.filter === 'boolean' ? full?.filter : undefined,
          punycode:
            typeof full?.punycode === 'boolean' ? full?.punycode : undefined,
          hlword: typeof full?.hlword === 'boolean' ? full?.hlword : undefined,
          delayed:
            typeof full?.delayed === 'boolean' ? full?.delayed : undefined,
        });

        await this.repo.update(
          { id: t.id },
          {
            status: 'SENT',
            externalTaskId: created.id,
            nextPollAt: this.calcInitialPollAt(),
            pollRetryCount: 0, // ← обнулить счетчик
          },
        );
        sent++;
      } catch (e) {
        const msg = (e as Error).message;
        this.log.warn(`PUSH FAIL #${t.id}: ${msg}`);

        // NEW: классификация и мягкая отложка при rate limit/timeout
        const cls = this.classifyCreateError(e);
        if (cls.transient) {
          const at = new Date(Date.now() + (cls.retryMs ?? 3000));
          await this.repo.update(
            { id: t.id },
            {
              status: 'QUEUED', // вернём обратно в очередь, чтобы ещё раз попробовать createTask
              // status: 'SENT', // вернём в SENT, чтобы снова подхватить poller'ом/пушером
              error: cls.reason,
              nextPollAt: at,
              pollRetryCount: 0,
            },
          );
        } else {
          await this.repo.update(
            { id: t.id },
            { status: 'ERROR', error: cls.reason },
          );
        }
      }
    }
    return sent;
  }

  /** Переводит SENT→POLLING, опрашивает внешний сервис и фиксирует результат. */
  async pollSent(limit = 100): Promise<number> {
    await this.recoverStalePolling();

    const rawPoll: unknown = await this.ds.query(SQL_POLL, [limit]);
    const picked = pickRows(rawPoll);

    const list = picked
      .map(toPickForSend)
      .filter((v): v is PickForSend => v !== null);

    if (picked.length > 0 && list.length === 0) {
      const ids = extractIds(picked);
      if (ids.length > 0) {
        await this.repo.update(
          { id: In(ids) },
          {
            status: 'SENT',
            nextPollAt: null, // ← иначе может «зависнуть» до старого времени
            pollRetryCount: 0, // ← на всякий случай обнулим
          },
        );
        this.log.warn(
          `pollSent: reverted ${ids.length} back to SENT (mapping failed)`,
        );
      }
      return 0;
    }

    let completed = 0;
    for (let i = 0; i < list.length; i += POLL_CONCURRENCY) {
      const chunk = list.slice(i, i + POLL_CONCURRENCY);
      const doneFlags = await Promise.all(
        chunk.map(async (t): Promise<number> => {
          if (!t.externalTaskId) {
            await this.repo.update(
              { id: t.id },
              { status: 'ERROR', error: ERR.MISSING_EXTERNAL_ID },
            );
            return 0;
          }
          try {
            const respRaw = await this.rs.getTask(t.externalTaskId);
            const resp = respRaw as unknown as RSGetTask;

            if (resp.status === 'pending') {
              const at = new Date(
                Date.now() + 2000 + Math.floor(Math.random() * 3000),
              );
              await this.repo.update(
                { id: t.id },
                { status: 'SENT', nextPollAt: at },
              );
              return 0;
            }

            if (resp.status === 'not_found') {
              const full = await this.repo.findOne({
                where: { id: t.id },
                select: [
                  'groupby',
                  'domain',
                  'domainId',
                  'tbm',
                  'tbs',
                  'hl',
                  'gl',
                  'ads',
                  'related',
                  'video',
                  'filter',
                  'punycode',
                  'hlword',
                  'delayed',
                  'latitude',
                  'longitude',
                  'uule',
                  'cityName',
                ],
              });
              const cityName: string | undefined =
                typeof (full?.cityName ?? t.cityName) === 'string'
                  ? (full?.cityName ?? t.cityName)!
                  : undefined;

              const created = await this.rs.createTask({
                query: t.query,
                device: t.device,
                lr: t.lr,
                searchEngine: 'google',
                page: t.page ?? 1,
                latitude: full?.latitude ?? t.latitude ?? undefined,
                longitude: full?.longitude ?? t.longitude ?? undefined,
                uule: full?.uule ?? t.uule ?? undefined,
                cityName,
                groupby:
                  full?.groupby && full.groupby >= 10 && full.groupby <= 100
                    ? full.groupby
                    : undefined,
                domain: full?.domain || undefined,
                domainId: full?.domainId ?? undefined,
                tbm: full?.tbm ?? undefined,
                tbs: full?.tbs ?? undefined,
                hl: full?.hl ?? undefined,
                gl: full?.gl ?? undefined,
                ads: typeof full?.ads === 'boolean' ? full?.ads : undefined,
                related:
                  typeof full?.related === 'boolean'
                    ? full?.related
                    : undefined,
                video:
                  typeof full?.video === 'boolean' ? full?.video : undefined,
                filter:
                  typeof full?.filter === 'boolean' ? full?.filter : undefined,
                punycode:
                  typeof full?.punycode === 'boolean'
                    ? full?.punycode
                    : undefined,
                hlword:
                  typeof full?.hlword === 'boolean' ? full?.hlword : undefined,
                delayed:
                  typeof full?.delayed === 'boolean'
                    ? full?.delayed
                    : undefined,
              });

              await this.repo.update(
                { id: t.id },
                {
                  status: 'SENT',
                  externalTaskId: created.id,
                  error: 'remote_task_not_found_recreated',
                  nextPollAt: this.calcInitialPollAt(),
                  pollRetryCount: 0,
                },
              );
              return 0;
            }

            if (resp.status === 'error') {
              const msg = String((resp as any).message ?? 'remote_error');
              const m = msg.toLowerCase();
              let reason: ErrorReason = ERR.REMOTE_ERROR;
              let transient = false;
              let retryMs = 0;

              if (m.includes('rate') && m.includes('limit')) {
                reason = ERR.RATE_LIMITED;
                transient = true;
                retryMs = 4000;
              } else if (m.includes('timeout')) {
                reason = ERR.TRANSIENT_FETCH_FAILED;
                transient = true;
                retryMs = 3000;
              } else if (m.includes('invalid') || m.includes('bad request')) {
                reason = ERR.BAD_PARAMS;
              }

              if (transient) {
                const at = new Date(Date.now() + retryMs);
                await this.repo.update(
                  { id: t.id },
                  {
                    status: 'SENT',
                    error: reason,
                    nextPollAt: at,
                    // pollRetryCount увеличим по общей ветке ниже (как для исключений)
                  },
                );
                // чтобы корректно посчитать ретраи — позволим пойти в catch и обработать счётчик
                throw new Error(reason);
              } else {
                await this.repo.update(
                  { id: t.id },
                  { status: 'ERROR', error: reason, nextPollAt: null },
                );
                return 0;
              }
            }

            await this.ds.transaction(async (trx) => {
              const repo = trx.getRepository(GoogleLiveTask);
              const ent = await repo.findOneOrFail({ where: { id: t.id } });

              const items = mapRsToSerpItems(resp.results);

              const pageExtras: Record<string, unknown> = {};
              if ('relatedQuestions' in resp && resp.relatedQuestions) {
                pageExtras.relatedQuestions = resp.relatedQuestions;
              }
              if ('knowledgeGraph' in resp && resp.knowledgeGraph) {
                pageExtras.knowledgeGraph = resp.knowledgeGraph;
              }
              const extrasPayload = Object.keys(pageExtras).length
                ? pageExtras
                : null;

              ent.status = 'COMPLETED';
              ent.results = items; // <-- тип сейчас совпадает с объявлением сущности
              ent.extras = extrasPayload; // <-- тоже
              ent.completedAt = new Date();
              ent.error = null;
              ent.nextPollAt = null;
              ent.pollRetryCount = 0;

              // сохраняем данные о страницах из RankScan (если есть)
              if ('totalPages' in resp && typeof resp.totalPages === 'number') {
                ent.totalPages = resp.totalPages;
              }
              if ('lastPage' in resp && typeof resp.lastPage === 'boolean') {
                ent.lastPage = resp.lastPage;
              }

              await repo.save(ent);

              const groupby = ent.groupby ?? 10;
              const pagesCount = Math.ceil(groupby / 10) || 1;
              const throughput = getRankScanThroughput(resp, pagesCount);
              await this.billing.charge(
                t.userId,
                SERVICE_CODE,
                pagesCount,
                `Google Live: "${t.query}" lr=${t.lr} (groupby=${groupby})`,
                ent.softId ?? null,
              );
              // Statistic
              try {
                const durationMs =
                  (ent.completedAt?.getTime?.() ?? Date.now()) -
                  (ent.createdAt?.getTime?.() ?? Date.now());

                for (const [server, pages] of Object.entries(
                  throughput.pagesByServer,
                )) {
                  await this.taskStats.recordTaskCompletion({
                    searchEngine: 'googlelive',
                    server,
                    sourceTaskId: ent.id,
                    device: ent.device,
                    durationMs,
                    pages,
                  });
                }
              } catch (err) {
                this.log.warn(
                  `TaskStats record failed for #${t.id}: ${(err as Error).message}`,
                );
              }
            });

            return 1;
          } catch (e) {
            const now = Date.now();
            if (isTransientError(e)) {
              // увеличим счётчик, назначим отложенный повтор
              const current = await this.repo.findOne({ where: { id: t.id } });
              const prev = current?.pollRetryCount ?? 0;
              const next = prev + 1;

              if (next > MAX_TRANSIENT_RETRIES) {
                // окончательно падаем
                const msg = (e as Error).message || 'transient_fetch_failed';
                this.log.warn(
                  `POLL give up #${t.id} after ${prev} retries: ${msg}`,
                );
                await this.repo.update(
                  { id: t.id },
                  { status: 'ERROR', error: msg, nextPollAt: null },
                );
              } else {
                const delayMs = calcNextDelayMs(next);
                const at = new Date(now + delayMs);
                this.log.warn(
                  `POLL transient #${t.id}, retry ${next} at ${at.toISOString()}`,
                );
                await this.repo.update(
                  { id: t.id },
                  {
                    status: 'SENT',
                    error: ERR.TRANSIENT_FETCH_FAILED,
                    pollRetryCount: next,
                    nextPollAt: at,
                  },
                );
              }
            } else {
              // не транзиентная — сразу ERROR
              const msg = (e as Error).message;
              this.log.warn(`POLL FAIL #${t.id}: ${msg}`);
              await this.repo.update(
                { id: t.id },
                { status: 'ERROR', error: msg, nextPollAt: null },
              );
            }
          }
          return 0;
        }),
      );
      completed += doneFlags.reduce((sum, v) => sum + v, 0);
    }
    return completed;
  }

  async getById(userId: number, id: number): Promise<GoogleLiveTask> {
    const t = await this.repo.findOne({ where: { id, userId } });
    if (!t) throw new NotFoundException('task_not_found');
    return t;
  }

  async deleteById(userId: number, id: number): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  async exportCitiesXlsx(): Promise<Buffer> {
    // 1) пробуем из кеша
    try {
      const cached = await this.cache.get<string>(XLSX_CACHE_KEY);
      if (cached) return Buffer.from(cached, 'base64');
    } catch (e) {
      this.log?.warn?.(`xlsx cache get failed: ${(e as Error).message}`);
    }

    // 2) достаём актуальные данные из БД
    const cities = await this.cityRepo.find({
      select: ['name', 'lr'],
      order: { name: 'ASC' },
    });

    // 3) собираем Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Public API';
    wb.created = new Date();

    const ws = wb.addWorksheet('Cities');
    ws.columns = [
      { header: 'Город', key: 'name', width: 40 },
      { header: 'LR', key: 'lr', width: 18 },
    ];

    for (const c of cities) {
      ws.addRow({ name: c.name, lr: String(c.lr) });
    }

    // 4) буфер и кеш (без any-кастов)
    const arrayBuf = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(arrayBuf);

    try {
      await this.cache.set(
        XLSX_CACHE_KEY,
        buf.toString('base64'),
        XLSX_CACHE_TTL_MS,
      );
    } catch (e) {
      this.log?.warn?.(`xlsx cache set failed: ${(e as Error).message}`);
    }

    return buf;
  }
}
