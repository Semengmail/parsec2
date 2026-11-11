// src/modules/public-api/yandexlive.service.ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  SerpResultExtras,
  SerpResultItem,
  YandexLiveTask,
} from './entities/yandexlive-task.entity';
import { RankScanClient, RSPageMetaItem, RSResult } from './rankscan.client';
import { BillingService } from '@/modules/billing/billing.service';
import {
  pickRows,
  extractIds,
  toPickForSend,
  type PickForSend,
  calcNextDelayMs,
  isTransientError,
  extractPageExtras,
} from './helpers/pollSent';
import { LimitsService } from '@/common/limits/limits.service';
import { TaskStatsService } from '../task-stats/task-stats.service';
import { EngineBlockService } from './engine-block.service';
import { getRankScanThroughput } from './helpers/rankscan-throughput';

/* =========================
 * Errors (единые константы)
 * ========================= */
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
  ENGINE_BLOCKED: 'engine_blocked',
} as const;
type ErrorReason = (typeof ERR)[keyof typeof ERR];

/* =========================
 * RankScan response unions
 * ========================= */
type RSPending = { status: 'pending' };
type RSNotFound = { status: 'not_found' };
type RSError = { status: 'error'; message?: string };

type RSCompleted = {
  status: 'completed';
  results: RSResult[];
  relatedQuestions?: string[] | null;
  knowledgeGraph?: Record<string, unknown> | null;
  pageMeta?: RSPageMetaItem[] | null;
  processedPages?: number;
  pagesByServer?: Record<string, number>;
};
type RSGetTask = RSPending | RSNotFound | RSError | RSCompleted;

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
  FROM public_yandexlive_tasks
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
  FROM public_yandexlive_tasks
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
  FROM public_yandexlive_tasks
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
  FROM public_yandexlive_tasks t
  JOIN ordered o ON o.id = t.id
  FOR UPDATE SKIP LOCKED
)
UPDATE public_yandexlive_tasks t
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
  t."externalTaskId"  AS "externalTaskId",
  t.status            AS "status";
`;

const SQL_POLL = `
WITH pick AS (
  SELECT id
  FROM public_yandexlive_tasks
  WHERE status = 'SENT'
    AND ("nextPollAt" IS NULL OR "nextPollAt" <= now())
  ORDER BY "createdAt", id
  FOR UPDATE SKIP LOCKED
  LIMIT $1
)
UPDATE public_yandexlive_tasks t
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
  t."externalTaskId"  AS "externalTaskId",
  t.status            AS "status";
`;

// биллинг-код сервиса
const SERVICE_CODE = 'YANDEX_LIVE' as const;

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

const MAX_TRANSIENT_RETRIES = 12;

// сколько задач Google сейчас «в работе»
const SQL_COUNT_INFLIGHT_TOTAL_GOOGLE = `
  SELECT COUNT(*)::int AS count
  FROM public_googlelive_tasks
  WHERE status IN ('SENDING','SENT','POLLING');
`;

type CreateYandexTaskPayload = {
  query: string;
  lr: number;
  device: 'desktop' | 'mobile';
  page?: number;

  groupby?: number; // 10..100, как у Google
  tbm?: '' | 'images' | 'video';
  related?: boolean;
  punycode?: boolean;
  hlword?: boolean;
  delayed?: boolean;
  domain?: 'ru' | 'by' | 'kz' | 'com.tr';

  softId?: string;
};

@Injectable()
export class YandexLiveService {
  private readonly log = new Logger(YandexLiveService.name);

  constructor(
    @InjectRepository(YandexLiveTask)
    private readonly repo: Repository<YandexLiveTask>,
    private readonly rs: RankScanClient,
    private readonly ds: DataSource,
    private readonly billing: BillingService,
    private readonly limits: LimitsService,
    private readonly taskStats: TaskStatsService,
    private readonly engineBlock: EngineBlockService,
  ) {}

  /* =========================
   * Валидация и ёмкость
   * ========================= */
  private validateCreateInput(dto: CreateYandexTaskPayload): void {
    if (!dto?.query || !String(dto.query).trim()) {
      throw new HttpException(ERR.EMPTY_QUERY, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!Number.isInteger(dto.lr) || dto.lr < 1 || dto.lr > 99_999_999) {
      throw new HttpException(ERR.INVALID_LR, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (dto.device !== 'desktop' && dto.device !== 'mobile') {
      throw new HttpException(
        ERR.INVALID_DEVICE,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (dto.groupby != null) {
      const g = Math.trunc(Number(dto.groupby));
      const ok = g === 10 || g === 20 || g === 30 || g === 50 || g === 100;
      if (!ok) {
        throw new HttpException(
          ERR.INVALID_GROUPBY,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
    if (dto.domain && !['ru', 'by', 'kz', 'com.tr'].includes(dto.domain)) {
      throw new HttpException(
        ERR.INVALID_DOMAIN,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async getOtherEngineInFlightTotal(): Promise<number> {
    const raw: unknown = await this.ds.query(SQL_COUNT_INFLIGHT_TOTAL_GOOGLE);
    const rows = pickRows(raw);
    const v = (rows[0] as { count?: unknown })?.count;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private async recoverStaleSending(): Promise<void> {
    const raw: unknown = await this.ds.query(
      `
      UPDATE public_yandexlive_tasks
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
      UPDATE public_yandexlive_tasks
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

  private async getMyFreeCapacity(): Promise<number> {
    const { total: inTotal } = await this.getInFlightByDevice();
    const other = await this.getOtherEngineInFlightTotal();

    const globalCap = await this.limits.getGlobalMaxInFlight();
    const fairCap = other > 0 ? Math.floor(globalCap / 2) : globalCap;
    const hardCap = Math.max(0, globalCap - other);
    const myMax = Math.min(fairCap, hardCap);
    return Math.max(0, myMax - inTotal);
  }

  /* =========================
   * Классификация ошибок create/push
   * ========================= */
  private classifyCreateError(e: unknown): {
    transient: boolean;
    reason: ErrorReason;
    retryMs?: number;
  } {
    const msg = (e as Error)?.message?.toLowerCase() || '';

    // любые сетевые / коннектные проблемы считаем транзиентными
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
      msg.includes('etimedout') ||
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

    if (msg.includes('timeout') || msg.includes('etimedout')) {
      return {
        transient: true,
        reason: ERR.TRANSIENT_FETCH_FAILED,
        retryMs: 3000,
      };
    }
    // 429 / rate limit
    if (msg.includes('rate') && msg.includes('limit')) {
      return { transient: true, reason: ERR.RATE_LIMITED, retryMs: 4000 };
    }
    if (msg.includes('quota') || msg.includes('too many')) {
      return { transient: true, reason: ERR.QUOTA_EXCEEDED, retryMs: 5000 };
    }
    if (msg.includes('invalid') || msg.includes('bad request')) {
      return { transient: false, reason: ERR.BAD_PARAMS };
    }
    return { transient: false, reason: ERR.REMOTE_ERROR };
  }

  private calcInitialPollAt(): Date {
    return new Date(
      Date.now() +
        INITIAL_POLL_DELAY_MS +
        Math.floor(Math.random() * INITIAL_POLL_JITTER_MS),
    );
  }

  async create(
    userId: number,
    dto: CreateYandexTaskPayload,
  ): Promise<YandexLiveTask> {
    this.validateCreateInput(dto);

    if (await this.engineBlock.isEngineBlocked('yandex')) {
      throw new HttpException('engine_blocked', HttpStatus.SERVICE_UNAVAILABLE);
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

    const pageNum = Number.isInteger(dto.page) ? (dto.page as number) : 0;
    const page = Math.min(10, Math.max(0, pageNum));

    const gb =
      typeof dto.groupby === 'number'
        ? Math.max(10, Math.min(100, Math.trunc(dto.groupby)))
        : null;

    const t = this.repo.create({
      userId,
      query: dto.query,
      lr: dto.lr,
      device: dto.device,
      page,

      groupby: gb,
      tbm: dto.tbm ?? null,
      related: typeof dto.related === 'boolean' ? dto.related : null,
      punycode: typeof dto.punycode === 'boolean' ? dto.punycode : null,
      hlword: typeof dto.hlword === 'boolean' ? dto.hlword : null,
      delayed: typeof dto.delayed === 'boolean' ? dto.delayed : null,

      softId: dto.softId ?? null,

      domain: dto.domain ?? null,

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
    page?: number;
  }): Promise<YandexLiveTask | null> {
    const pageNum = Number.isInteger(input.page) ? (input.page as number) : 0;
    const page = Math.min(10, Math.max(0, pageNum));
    return this.repo.findOne({
      where: {
        userId: input.userId,
        query: input.query,
        lr: input.lr,
        device: input.device,
        page,
      },
      order: { id: 'DESC' },
    });
  }

  /** Узнаём, сколько задач уже «в работе». */
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

    // динамический потолок для Яндекс-ветки
    const globalCap = await this.limits.getGlobalMaxInFlight();
    const settings = await this.limits.getSettings();
    const userLimit = settings.services.yandexLive.userRequestLimit;
    const adminLimit = settings.services.yandexLive.adminRequestLimit;
    const fairCap = otherInFlight > 0 ? Math.floor(globalCap / 2) : globalCap;
    const hardCap = Math.max(0, globalCap - otherInFlight);
    const myMax = Math.min(fairCap, hardCap);

    const free = Math.max(0, myMax - inTotal);
    if (free <= 0) return 0;

    const toTake = Math.min(tickCap, free);

    // 2) целевое распределение после добора (держим 1 : 1.5)
    const targetTotal = inTotal + toTake;

    const ratio = this.limits.getDeviceRatio();
    const ratioSum = ratio.desktop + ratio.mobile;

    const targetDesktop = Math.round((targetTotal * ratio.desktop) / ratioSum);
    const targetMobile = targetTotal - targetDesktop;

    const needD = Math.max(0, targetDesktop - inD);
    const needM = Math.max(0, targetMobile - inM);

    const quotaD = Math.min(needD, toTake);
    const quotaM = Math.min(needM, Math.max(0, toTake - quotaD));

    // 3) первый заход по квотам
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

    // 4) добор остатка
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

    // 5) маппинг к типу отправки
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
      return 0;
    }

    // 6) пейсинг
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
      try {
        this.log.log(
          `PUSH: #${t.id} "${t.query}" lr=${t.lr} dev=${t.device} page=${t.page}`,
        );

        const full = await this.repo.findOne({
          where: { id: t.id },
          select: [
            'groupby',
            'tbm',
            'related',
            'punycode',
            'hlword',
            'delayed',
          ],
        });

        const created = await this.rs.createTask({
          query: t.query,
          device: t.device,
          lr: t.lr,
          searchEngine: 'yandexlive',
          page: t.page,
          groupby:
            typeof full?.groupby === 'number' &&
            full.groupby >= 10 &&
            full.groupby <= 100
              ? full.groupby
              : undefined,
          tbm: full?.tbm ?? undefined,
          related:
            typeof full?.related === 'boolean' ? full.related : undefined,
          punycode:
            typeof full?.punycode === 'boolean' ? full.punycode : undefined,
          hlword: typeof full?.hlword === 'boolean' ? full.hlword : undefined,
          delayed:
            typeof full?.delayed === 'boolean' ? full.delayed : undefined,
        });

        await this.repo.update(
          { id: t.id },
          {
            status: 'SENT',
            externalTaskId: created.id,
            nextPollAt: this.calcInitialPollAt(),
            pollRetryCount: 0,
          },
        );

        sent++;
      } catch (e) {
        const cls = this.classifyCreateError(e);
        this.log.warn(`PUSH FAIL #${t.id}: ${(e as Error).message}`);

        if (cls.transient) {
          // transient ошибка → возвращаем обратно в QUEUED чтобы повторить createTask
          await this.repo.update(
            { id: t.id },
            {
              status: 'QUEUED',
              error: cls.reason,
              externalTaskId: null,
              nextPollAt: new Date(Date.now() + (cls.retryMs ?? 3000)),
              pollRetryCount: 0,
            },
          );
        } else {
          // non-transient → ставим ERROR
          await this.repo.update(
            { id: t.id },
            {
              status: 'ERROR',
              error: cls.reason,
              externalTaskId: null,
              nextPollAt: null,
            },
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
          { status: 'SENT', nextPollAt: null, pollRetryCount: 0 },
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
                  'tbm',
                  'related',
                  'punycode',
                  'hlword',
                  'delayed',
                ],
              });

              const created = await this.rs.createTask({
                query: t.query,
                device: t.device,
                lr: t.lr,
                searchEngine: 'yandexlive',
                page: t.page,
                groupby:
                  typeof full?.groupby === 'number' &&
                  full.groupby >= 10 &&
                  full.groupby <= 100
                    ? full.groupby
                    : undefined,
                tbm: full?.tbm ?? undefined,
                related:
                  typeof full?.related === 'boolean' ? full.related : undefined,
                punycode:
                  typeof full?.punycode === 'boolean'
                    ? full.punycode
                    : undefined,
                hlword:
                  typeof full?.hlword === 'boolean' ? full.hlword : undefined,
                delayed:
                  typeof full?.delayed === 'boolean' ? full.delayed : undefined,
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
              const msg = String(
                (resp as any).message ?? 'remote_error',
              ).toLowerCase();
              let reason: ErrorReason = ERR.REMOTE_ERROR;
              let transient = false;
              let retryMs = 0;

              if (msg.includes('rate') && msg.includes('limit')) {
                reason = ERR.RATE_LIMITED;
                transient = true;
                retryMs = 4000;
              } else if (msg.includes('timeout')) {
                reason = ERR.TRANSIENT_FETCH_FAILED;
                transient = true;
                retryMs = 3000;
              } else if (
                msg.includes('invalid') ||
                msg.includes('bad request')
              ) {
                reason = ERR.BAD_PARAMS;
              }

              if (transient) {
                const at = new Date(Date.now() + retryMs);
                await this.repo.update(
                  { id: t.id },
                  { status: 'SENT', error: reason, nextPollAt: at },
                );
                // кинем, чтобы общий catch увеличил pollRetryCount
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
              const repo = trx.getRepository(YandexLiveTask);
              const ent = await repo.findOneOrFail({ where: { id: t.id } });

              const items = mapRsToSerpItems(resp.results);
              const pageExtras = extractPageExtras(resp);
              const extrasPayload = Object.keys(pageExtras).length
                ? pageExtras
                : null;

              ent.status = 'COMPLETED';
              ent.results = items;
              ent.extras = extrasPayload;
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
                `Yandex Live: "${t.query}" lr=${t.lr} (groupby=${groupby})`,
                ent.softId ?? null,
              );
              try {
                const durationMs =
                  (ent.completedAt?.getTime?.() ?? Date.now()) -
                  (ent.createdAt?.getTime?.() ?? Date.now());

                for (const [server, pages] of Object.entries(
                  throughput.pagesByServer,
                )) {
                  await this.taskStats.recordTaskCompletion({
                    searchEngine: 'yandexlive',
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

  async getById(userId: number, id: number): Promise<YandexLiveTask> {
    const t = await this.repo.findOne({ where: { id, userId } });
    if (!t) throw new NotFoundException('task_not_found');
    return t;
  }

  async deleteById(userId: number, id: number): Promise<void> {
    await this.repo.delete({ id, userId });
  }
}
