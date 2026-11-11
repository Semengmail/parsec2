// src/modules/test-bench/test-bench.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';

import {
  TestBenchPhrase,
  TestBenchPhraseType,
} from './entities/test-bench-phrase.entity';
import { TestBenchRun } from './entities/test-bench-run.entity';
import { GoogleLiveService } from '@/modules/public-api/googlelive.service';
import { YandexLiveService } from '@/modules/public-api/yandexlive.service';
import {
  TestBenchPosition,
  TestBenchPositionDevice,
  TestBenchPositionEngine,
} from './entities/test-bench-position.entity';
import {
  TestBenchCheck,
  TestBenchCheckLevel,
  TestBenchCheckType,
} from './entities/test-bench-check.entity';
import { SelectorReportDto } from './dto/selector-report.dto';
import { SerpResultItem } from '../public-api/entities/googlelive-task.entity';
import {
  SelectorRunTaskIds,
  TestBenchSelectorRun,
} from './entities/test-bench-selector-runs.entity';
import { TestBenchEngineConfig } from './entities/test-bench-engine-config.entity';
import { RankScanLockClient, RankScanLockState } from './rankscan-lock.client';
import { TestBenchCaptchaService } from './test-bench-captcha.service';
import { PublicApiPauseService } from '../public-api/public-api-pause.service';
import { AlertingService } from '@/shared/alerting/alerting.service';
import { RankScanClient } from '../public-api/rankscan.client';

type Engine = 'yandex' | 'google';
type Device = 'desktop' | 'mobile';

interface StatusRow {
  status: string;
  cnt: number;
}

interface WaitResult {
  completed: number;
  errors: number;
  still: number;
}

interface CountRow {
  cnt: number;
}

@Injectable()
export class TestBenchService {
  private readonly log = new Logger(TestBenchService.name);

  /** Настройки speed-теста */
  private readonly phrasesTarget = 100;
  private readonly top = 30;
  private readonly device: Device = 'desktop';
  private readonly lrYandex = 213;
  private readonly lrGoogle = 1_011_969;
  private readonly waitTimeoutMs = 25 * 60 * 1000; // 25 мин
  private readonly pollIntervalMs = 1000; // 1 сек
  private readonly userId = 2; // тестовый пользователь

  /** Настройки теста позиций */
  private readonly positionTestPhrasesPerEngine = 10;
  private readonly positionTestTimeoutMs = 15 * 60 * 1000; // 15 мин
  private readonly positionTestLookBackDays = 5;
  private readonly selectorFailureConfirmationWindowMs = 3 * 60 * 60 * 1000;
  private readonly selectorReportAttachWindowMs = 6 * 60 * 60 * 1000;
  private currentSelectorTestTs: Date | null = null;
  private lastCaptchaRunMinute: string | null = null;

  constructor(
    @InjectRepository(TestBenchPhrase)
    private readonly phrasesRepo: Repository<TestBenchPhrase>,
    @InjectRepository(TestBenchRun)
    private readonly runsRepo: Repository<TestBenchRun>,
    @InjectRepository(TestBenchPosition)
    private readonly positionsRepo: Repository<TestBenchPosition>,
    @InjectRepository(TestBenchCheck)
    private readonly checksRepo: Repository<TestBenchCheck>,
    @InjectRepository(TestBenchSelectorRun)
    private readonly selectorRunsRepo: Repository<TestBenchSelectorRun>,
    @InjectRepository(TestBenchEngineConfig)
    private readonly engineConfigRepo: Repository<TestBenchEngineConfig>,
    private readonly google: GoogleLiveService,
    private readonly yandex: YandexLiveService,
    private readonly ds: DataSource,
    private readonly alerting: AlertingService,
    private readonly rankScanLock: RankScanLockClient,
    private readonly rankScan: RankScanClient,
    private readonly captchaService: TestBenchCaptchaService,
    private readonly pause: PublicApiPauseService,
  ) {}

  private sendTelegramAlert(msg: string) {
    this.alerting.safeCritical('Тест-бенч', msg);
  }

  private isStageEnvironment(): boolean {
    return [
      process.env.NODE_ENV,
      process.env.APP_ENV,
      process.env.ENVIRONMENT,
      process.env.DEPLOY_ENV,
    ]
      .filter(Boolean)
      .some((env) =>
        ['development', 'stage', 'staging'].includes(env!.toLowerCase()),
      );
  }

  private sendCaptchaMetricsAlert(msg: string) {
    if (this.isStageEnvironment()) {
      this.log.warn(`[STAGE][CaptchaMetrics report suppressed]\n${msg}`);
      return;
    }

    this.sendTelegramAlert(msg);
  }

  private async getEngineConfig(
    engine: Engine,
  ): Promise<TestBenchEngineConfig> {
    let cfg = await this.engineConfigRepo.findOne({ where: { engine } });

    if (!cfg) {
      cfg = this.engineConfigRepo.create({
        engine,
        positionJumpDiffWarning: 10,
        maxMissingPositionsPerRun: 0,
      });
      cfg = await this.engineConfigRepo.save(cfg);
    }

    return cfg;
  }

  private async recoverStuckPublicApiTasks(): Promise<void> {
    this.log.warn('🛠 Recovering stuck public-api tasks → QUEUED');

    type IdRow = { id: number };

    // --- Yandex ---
    const yRes = await this.ds.query<IdRow[]>(`
    UPDATE public_yandexlive_tasks
    SET status = 'QUEUED'
    WHERE status IN ('SENDING','SENT','POLLING')
      AND "externalTaskId" IS NULL
      AND "updatedAt" < now() - interval '30 seconds'
    RETURNING id;
  `);

    // --- Google ---
    const gRes = await this.ds.query<IdRow[]>(`
    UPDATE public_googlelive_tasks
    SET status = 'QUEUED'
    WHERE status IN ('SENDING','SENT','POLLING')
      AND "externalTaskId" IS NULL
      AND "updatedAt" < now() - interval '30 seconds'
    RETURNING id;
  `);

    const yCnt = yRes.length;
    const gCnt = gRes.length;

    if (yCnt > 0 || gCnt > 0) {
      this.log.warn(`🛠 Recovery done: yandex=${yCnt}, google=${gCnt}`);
    } else {
      this.log.log('🛠 Recovery: no stuck tasks found');
    }
  }

  private async waitForPublicApiDrain(options?: {
    maxRemaining?: number;
    timeoutMs?: number;
    pollMs?: number;
  }): Promise<void> {
    const maxRemaining = options?.maxRemaining ?? 5;
    const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000;
    const pollMs = options?.pollMs ?? 2000;

    const started = Date.now();

    for (;;) {
      const rows = await this.ds.query<{ cnt: number }[]>(`
      SELECT COUNT(*)::int AS cnt
      FROM (
        SELECT id FROM public_yandexlive_tasks
        WHERE status IN ('SENDING','SENT','POLLING')
        UNION ALL
        SELECT id FROM public_googlelive_tasks
        WHERE status IN ('SENDING','SENT','POLLING')
      ) t
    `);

      const cnt = Number(rows?.[0]?.cnt ?? 0);

      if (cnt <= maxRemaining) {
        this.log.log(`🟢 public-api drained enough: ${cnt} ≤ ${maxRemaining}`);
        return;
      }

      if (Date.now() - started > timeoutMs) {
        this.log.warn(
          `⚠️ drain timeout: ${cnt} tasks still in-flight — forcing recovery`,
        );

        await this.recoverStuckPublicApiTasks();

        return;
      }

      this.log.log(
        `⏳ waiting drain: ${cnt} in-flight (threshold=${maxRemaining})`,
      );

      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  /** Запуск speed-теста: каждый день в 05:00 и 22:00 по Москве */
  @Cron('0 0 5,22 * * *', { timeZone: 'Europe/Moscow' })
  async cronRun(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.log.log('🧪 [SpeedTest] skipping in development environment');
      return;
    }
    try {
      await this.runAll();
    } catch (err) {
      const e = err as Error;
      this.log.error(`cronRun failed: ${e.message}`, e.stack);
    }
  }

  /**
   * Общий speed-цикл: сначала Яндекс, потом Google.
   * Использует advisory-lock, чтобы не запускаться параллельно.
   */
  async runAll(): Promise<void> {
    const client = this.ds.createQueryRunner();
    await client.connect();

    type LockRow = { pg_try_advisory_lock: boolean };

    const res = (await client.query(
      `SELECT pg_try_advisory_lock(424242)`,
    )) as LockRow[];

    const locked = res.length > 0 && res[0].pg_try_advisory_lock === true;

    if (!locked) {
      this.log.warn(
        '⚠️ TestBench already running on another instance, skipping.',
      );
      await client.release();
      return;
    }

    try {
      // 1️⃣ ВКЛЮЧАЕМ ПАУЗУ (разрешаем только test-bench userId)
      await this.pause.pause({
        reason: 'test-bench',
        allowUserId: this.userId,
        ttlSec: 30 * 60,
      });

      // await this.waitForPublicApiDrain({
      //   maxRemaining: 5,
      //   timeoutMs: 10 * 60 * 1000,
      // });
      await new Promise((r) => setTimeout(r, 30_000));
      await this.recoverStuckPublicApiTasks();

      const yRun = await this.runEngine('yandex');
      this.log.log(
        `✅ Yandex test done #${yRun.id}: ${yRun.durationMs}ms (interfered=${yRun.interfered})`,
      );

      const gRun = await this.runEngine('google');
      this.log.log(
        `✅ Google test done #${gRun.id}: ${gRun.durationMs}ms (interfered=${gRun.interfered})`,
      );
    } catch (e) {
      const err = e as Error;
      this.log.error(`runAll failed: ${err.message}`, err.stack);
    } finally {
      try {
        await this.pause.resume();
        this.log.log('🟢 Public API resumed after test-bench');
      } catch (e) {
        this.log.warn(
          `Failed to resume public-api pause: ${(e as Error).message}`,
        );
      }

      try {
        await client.query(`SELECT pg_advisory_unlock(424242)`);
      } catch (unlockErr) {
        this.log.warn(`unlock failed: ${(unlockErr as Error).message}`);
      }

      await client.release();
    }
  }

  /** Параметры движка (lr + device) для speed/position-тестов */
  private pickEngineParams(engine: Engine): {
    lr: number;
    device: Device;
  } {
    return {
      lr: engine === 'yandex' ? this.lrYandex : this.lrGoogle,
      device: this.device,
    };
  }

  /**
   * Фразы для speed-теста:
   * type = 'speed', active = true, поисковик НЕ учитываем (вариант B).
   */
  private async getSpeedPhrases(limit: number): Promise<string[]> {
    const rows = await this.phrasesRepo.find({
      where: {
        active: true,
        type: 'speed' as TestBenchPhraseType,
      },
      order: { id: 'ASC' },
      take: limit,
    });
    return rows.map((r) => r.phrase);
  }

  /** Подсчёт количества активных задач во "встречном" движке */
  private async countForeignInFlight(engine: Engine): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS cnt
      FROM public_${engine === 'yandex' ? 'googlelive' : 'yandexlive'}_tasks
      WHERE status IN ('SENDING','SENT','POLLING');
    `;
    const rows = await this.ds.query<CountRow[]>(sql);
    const count = Number(rows?.[0]?.cnt ?? 0);
    return Number.isFinite(count) ? count : 0;
  }

  /** Создание тестовых задач для Яндекса или Google */
  private async createTasks(
    engine: Engine,
    phrases: string[],
    lr: number,
    device: Device,
  ): Promise<number[]> {
    const ids: number[] = [];

    for (const query of phrases) {
      try {
        // одна задача собирает весь топ (groupby=top)
        const payload = {
          query,
          lr,
          device,
          groupby: this.top,
        } as const;

        const task =
          engine === 'yandex'
            ? await this.yandex.create(this.userId, payload)
            : await this.google.create(this.userId, payload);

        ids.push(task.id);
      } catch (err) {
        const e = err as Error;
        this.log.warn(`${engine} create failed for "${query}": ${e.message}`);
      }
    }

    this.log.log(
      `[${engine}] created ${ids.length} tasks (groupby=${this.top})`,
    );
    return ids;
  }

  /** Ожидание завершения задач для speed-теста (без отдельного timeout) */
  private async waitUntilFinished(
    engine: Engine,
    ids: number[],
  ): Promise<WaitResult> {
    const table =
      engine === 'yandex'
        ? 'public_yandexlive_tasks'
        : 'public_googlelive_tasks';

    const started = Date.now();
    let maxForeign = 0;

    for (;;) {
      const foreign = await this.countForeignInFlight(engine);
      if (foreign > maxForeign) maxForeign = foreign;

      const rows = await this.ds.query<StatusRow[]>(
        `
        SELECT status, COUNT(*)::int AS cnt
        FROM ${table}
        WHERE id = ANY($1)
        GROUP BY status;
        `,
        [ids],
      );

      let completed = 0;
      let errors = 0;

      for (const row of rows) {
        if (row.status === 'COMPLETED') completed += row.cnt;
        if (row.status === 'ERROR') errors += row.cnt;
      }

      const done = completed + errors;
      if (done >= ids.length) {
        return { completed, errors, still: 0 };
      }

      if (Date.now() - started > this.waitTimeoutMs) {
        this.log.warn(
          `${engine} timeout: completed=${completed}, errors=${errors}`,
        );
        return { completed, errors, still: ids.length - done };
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  /** Очистка отработанных задач из таблиц public_*_tasks */
  private async cleanupTasks(engine: Engine, ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    const table =
      engine === 'yandex'
        ? 'public_yandexlive_tasks'
        : 'public_googlelive_tasks';

    try {
      const rows = await this.ds.query<
        {
          id: number;
          externalTaskId: number | null;
        }[]
      >(
        `
        SELECT id, "externalTaskId"
        FROM ${table}
        WHERE id = ANY($1);
        `,
        [ids],
      );

      const drainedIds: number[] = [];

      for (const row of rows) {
        const externalId = Number(row.externalTaskId);
        if (!Number.isInteger(externalId) || externalId <= 0) {
          drainedIds.push(row.id);
          continue;
        }

        try {
          const resp = await this.rankScan.getTask(externalId);
          if (resp.status === 'completed' || resp.status === 'not_found') {
            drainedIds.push(row.id);
          } else {
            this.log.warn(
              `cleanup ${engine}: remote task ${externalId} is still pending, local #${row.id} kept`,
            );
          }
        } catch (err) {
          const e = err as Error;
          this.log.warn(
            `cleanup ${engine}: remote drain failed for #${row.id}/${externalId}: ${e.message}`,
          );
        }
      }

      if (drainedIds.length > 0) {
        await this.ds.query(`DELETE FROM ${table} WHERE id = ANY($1);`, [
          drainedIds,
        ]);
      }

      const skipped = ids.length - drainedIds.length;
      if (skipped > 0) {
        this.log.warn(
          `cleanup ${engine}: kept ${skipped} task(s) because RankScan result was not drained`,
        );
      }
    } catch (err) {
      const e = err as Error;
      this.log.warn(`cleanup ${engine} failed: ${e.message}`);
    }
  }

  private async cleanupSelectorRunTasks(
    taskIds: SelectorRunTaskIds | null | undefined,
  ): Promise<void> {
    if (!taskIds) return;

    await Promise.all([
      this.cleanupTasks('yandex', taskIds.yandex ?? []),
      this.cleanupTasks('google', taskIds.google ?? []),
    ]);
  }

  private async cleanupOldSelectorPublicApiTasks(): Promise<void> {
    const phrases = await this.phrasesRepo.find({
      where: { type: 'selector' },
      select: ['phrase'],
    });
    const phraseTexts = phrases.map((p) => p.phrase);
    if (phraseTexts.length === 0) return;

    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const statuses = ['COMPLETED', 'ERROR'];

    const [yandexRows, googleRows] = await Promise.all([
      this.ds.query<{ id: number }[]>(
        `
        SELECT id
        FROM public_yandexlive_tasks
        WHERE "userId" = $1
          AND query = ANY($2)
          AND status = ANY($3)
          AND "createdAt" < $4;
        `,
        [this.userId, phraseTexts, statuses, cutoff],
      ),
      this.ds.query<{ id: number }[]>(
        `
        SELECT id
        FROM public_googlelive_tasks
        WHERE "userId" = $1
          AND query = ANY($2)
          AND status = ANY($3)
          AND "createdAt" < $4;
        `,
        [this.userId, phraseTexts, statuses, cutoff],
      ),
    ]);

    await Promise.all([
      this.cleanupTasks(
        'yandex',
        yandexRows.map((row) => row.id),
      ),
      this.cleanupTasks(
        'google',
        googleRows.map((row) => row.id),
      ),
    ]);
  }

  private calcPagesPerMinute(
    totalPages: number,
    durationMs: number | null,
  ): number | null {
    if (!durationMs || durationMs <= 0) return null;
    const minutes = durationMs / 1000 / 60;
    return minutes > 0 ? totalPages / minutes : null;
  }

  /** Один полный speed-прогон для Яндекса или Google */
  /** Один полный speed-прогон для Яндекса или Google */
  async runEngine(engine: Engine): Promise<TestBenchRun> {
    const { lr } = this.pickEngineParams(engine);
    const cfg = await this.getEngineConfig(engine);

    const limit =
      typeof cfg.speedTestLimit === 'number' && cfg.speedTestLimit > 0
        ? cfg.speedTestLimit
        : this.phrasesTarget;

    const phrases = await this.getSpeedPhrases(limit);
    const phrasesCount = phrases.length;

    // RankScan собирает весь TOP (groupby=N) за один запрос → 1 "страница"
    const pagesPerTask = 1;
    const totalPages = phrasesCount * pagesPerTask;

    const run = this.runsRepo.create({
      startedAt: new Date(),
      engine,
      device: this.device,
      top: this.top,
      phrasesCount,
      pagesPerTask,
      totalPages,
    });
    await this.runsRepo.save(run);

    const foreignAtStart = await this.countForeignInFlight(engine);
    const createdIds = await this.createTasks(engine, phrases, lr, this.device);

    const startTime = Date.now();
    const { completed, errors } = await this.waitUntilFinished(
      engine,
      createdIds,
    );
    const durationMs = Date.now() - startTime;

    await this.cleanupTasks(engine, createdIds);

    run.finishedAt = new Date();
    run.durationMs = String(durationMs);
    run.pagesPerMinute = this.calcPagesPerMinute(totalPages, durationMs);
    run.completedCount = completed;
    run.errorCount = errors;
    run.taskIds = createdIds;
    run.interfered = foreignAtStart > 0;
    run.maxForeignInFlight = foreignAtStart;

    await this.runsRepo.save(run);
    return run;
  }

  /** Для админки: последние N speed-прогонов */
  async getRuns(
    params: { limit?: number; engine?: Engine | 'all' } = {},
  ): Promise<TestBenchRun[]> {
    const qb = this.runsRepo
      .createQueryBuilder('r')
      .orderBy('r.startedAt', 'DESC')
      .limit(params.limit ?? 200);

    if (params.engine && params.engine !== 'all') {
      qb.andWhere('r.engine = :e', { e: params.engine });
    }

    return qb.getMany();
  }

  /** Для админки: последние скорости по Яндексу и Гуглу */
  async getLatestSpeeds(): Promise<{
    yandex: number | null;
    google: number | null;
  }> {
    const [yandex] = await this.runsRepo.find({
      where: { engine: 'yandex' },
      order: { startedAt: 'DESC' },
      take: 1,
    });

    const [google] = await this.runsRepo.find({
      where: { engine: 'google' },
      order: { startedAt: 'DESC' },
      take: 1,
    });

    return {
      yandex: yandex?.pagesPerMinute ?? null,
      google: google?.pagesPerMinute ?? null,
    };
  }

  /** Тест ПОЗИЦИЙ/СЕЛЕКТОРОВ: каждый час в 30 минут по Москве */
  @Cron('0 30 * * * *', { timeZone: 'Europe/Moscow' })
  async cronRunPositions(): Promise<void> {
    const testTs = new Date();
    this.log.log(
      '🧪 [PositionsTest] cronRunPositions triggered (:30 MSK)',
      `ENV = ${process.env.NODE_ENV}`,
    );
    if (process.env.NODE_ENV === 'development') {
      this.log.log('🧪 [PositionsTest] skipping in development environment');
      return;
    }
    const client = this.ds.createQueryRunner();
    await client.connect();

    type LockRow = { pg_try_advisory_lock: boolean };

    // Отдельный advisory lock, чтобы не пересекаться с speed-тестом
    const res = (await client.query(
      `SELECT pg_try_advisory_lock(424243)`,
    )) as LockRow[];
    const locked = res.length > 0 && res[0].pg_try_advisory_lock === true;

    if (!locked) {
      this.log.warn(
        '⚠️ [PositionsTest] already running on another instance, skipping.',
      );
      await client.release();
      return;
    }

    try {
      await this.runPositionsTest(testTs);
      await this.runSelectorsTest(testTs);
    } catch (err) {
      const e = err as Error;
      this.log.error(`cronRunPositions failed: ${e.message}`, e.stack);
    } finally {
      try {
        await this.evaluateGlobalChecks(testTs);
        await client.query(`SELECT pg_advisory_unlock(424243)`);
        this.log.debug('Тест-бенч завершен');
      } catch (unlockErr) {
        this.log.warn(
          `[PositionsTest] unlock failed: ${(unlockErr as Error).message}`,
        );
      }
      await client.release();
    }
  }

  /** Запуск позиционного теста для обоих движков + чистка старых данных */
  private async runPositionsTest(testTs: Date = new Date()): Promise<void> {
    const [y, g] = await Promise.all([
      this.runPositionsForEngine('yandex', testTs),
      this.runPositionsForEngine('google', testTs),
    ]);

    this.log.log(
      `✅ [PositionsTest] done: yandex phrases=${y.phrasesCount}, google phrases=${g.phrasesCount}`,
    );

    await this.cleanupOldPositionsAndChecks();
  }

  private async cleanupOldPositionsAndChecks(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.positionTestLookBackDays * 24 * 60 * 60 * 1000,
    );

    await this.positionsRepo
      .createQueryBuilder()
      .delete()
      .from(TestBenchPosition)
      .where('collectedAt < :cutoff', { cutoff })
      .execute();

    await this.checksRepo
      .createQueryBuilder()
      .delete()
      .from(TestBenchCheck)
      .where('createdAt < :cutoff', { cutoff })
      .execute();
  }

  /** Вытянуть позиции конкретного сайта из сырых результатов по задачам */
  private async extractPositionsForSite(
    engine: Engine,
    taskIds: number[],
    site: string,
  ): Promise<{ taskId: number; phrase: string; position: number | null }[]> {
    const table =
      engine === 'yandex'
        ? 'public_yandexlive_tasks'
        : 'public_googlelive_tasks';

    interface RawRow {
      id: number;
      query: string;
      results: unknown;
    }

    const rows = await this.ds.query<RawRow[]>(
      `
      SELECT id, query, results
      FROM ${table}
      WHERE id = ANY($1)
        AND status = 'COMPLETED'
      `,
      [taskIds],
    );

    const out: {
      taskId: number;
      phrase: string;
      position: number | null;
    }[] = [];

    for (const row of rows) {
      const rawResults = row.results;

      const docs: SerpResultItem[] = Array.isArray(rawResults)
        ? rawResults.filter(
            (x): x is SerpResultItem =>
              typeof x === 'object' &&
              x !== null &&
              'position' in x &&
              'url' in x,
          )
        : [];

      let minPos: number | null = null;

      for (const doc of docs) {
        const { url, position } = doc;
        if (!url || typeof position !== 'number') continue;

        if (url.includes(site)) {
          if (minPos === null || position < minPos) {
            minPos = position;
          }
        }
      }

      out.push({
        taskId: row.id,
        phrase: row.query,
        position: minPos,
      });
    }

    return out;
  }

  /** Универсальный выбор фраз по type + движку (для position / selector) */
  private async getPhrasesByTypeForEngine(
    type: TestBenchPhraseType,
    engine: Engine,
    limit: number,
  ): Promise<TestBenchPhrase[]> {
    const qb = this.phrasesRepo
      .createQueryBuilder('p')
      .where('p.active = true')
      .andWhere('p.type = :type', { type })
      .andWhere('(p.searchEngine IS NULL OR p.searchEngine = :engine)', {
        engine,
      })
      .orderBy('p.id', 'ASC')
      .limit(limit);

    return qb.getMany();
  }

  /** Позиционный тест для одного движка */
  /** Позиционный тест для одного движка */
  private async runPositionsForEngine(
    engine: Engine,
    testTs: Date = new Date(),
  ): Promise<{ engine: Engine; phrasesCount: number }> {
    const { lr } = this.pickEngineParams(engine);
    const cfg = await this.getEngineConfig(engine);

    const limit =
      typeof cfg.positionTestLimit === 'number' && cfg.positionTestLimit > 0
        ? cfg.positionTestLimit
        : this.positionTestPhrasesPerEngine;

    const phrases = await this.getPhrasesByTypeForEngine(
      'position',
      engine,
      limit,
    );
    const phrasesCount = phrases.length;

    if (!phrasesCount) {
      this.log.warn(
        `[PositionsTest][${engine}] no active phrases of type=position`,
      );
      return { engine, phrasesCount: 0 };
    }

    const phraseTexts = phrases.map((p) => p.phrase);
    const createdIds = await this.createTasks(
      engine,
      phraseTexts,
      lr,
      this.device,
    );

    const startTime = Date.now();
    const { completed, errors, still } =
      await this.waitUntilFinishedWithTimeout(
        engine,
        createdIds,
        this.positionTestTimeoutMs,
      );
    const durationMs = Date.now() - startTime;

    if (still > 0) {
      await this.createCheck({
        engine,
        device: this.device,
        type: 'positions_timeout',
        ok: false,
        level: 'error',
        message: `[${engine}] positions test timeout: completed=${completed}, errors=${errors}, still=${still}`,
        payload: {
          completed,
          errors,
          still,
          timeoutMs: this.positionTestTimeoutMs,
        },
        createdAt: testTs,
      });
    }

    const collectedAt = testTs;
    const site = cfg.positionTestSite;

    const positions = await this.extractPositionsForSite(
      engine,
      createdIds,
      site,
    );

    for (const item of positions) {
      const phraseEntity = phrases.find((p) => p.phrase === item.phrase);
      if (!phraseEntity) continue;

      const positionEntity = this.positionsRepo.create({
        engine: engine,
        device: this.device,
        collectedAt,
        phraseId: phraseEntity.id,
        phraseText: phraseEntity.phrase,
        phrase: phraseEntity,
        site,
        position: item.position,
        createdAt: testTs,
      });

      await this.positionsRepo.save(positionEntity);

      await this.evaluatePositionChecks(
        engine,
        this.device,
        phraseEntity,
        site,
        positionEntity.position,
        testTs,
        cfg,
      );
    }

    await this.cleanupTasks(engine, createdIds);

    const missingCount = positions.filter((p) => p.position === null).length;

    if (missingCount > cfg.maxMissingPositionsPerRun) {
      await this.createCheck({
        engine,
        device: this.device,
        type: 'positions_missing_many',
        ok: false,
        level: 'warning',
        phrase: null,
        message: `[${engine}] Too many missing positions: ${missingCount} (limit=${cfg.maxMissingPositionsPerRun})`,
        payload: {
          missingCount,
          limit: cfg.maxMissingPositionsPerRun,
          phrasesCount,
        },
        createdAt: testTs,
      });
    }

    this.log.log(
      `✅ [PositionsTest][${engine}] phrases=${phrasesCount}, createdTasks=${createdIds.length}, durationMs=${durationMs}`,
    );

    return { engine, phrasesCount };
  }

  /** Ожидание завершения задач с отдельным timeout-ом */
  private async waitUntilFinishedWithTimeout(
    engine: Engine,
    ids: number[],
    timeoutMs: number,
  ): Promise<WaitResult> {
    const table =
      engine === 'yandex'
        ? 'public_yandexlive_tasks'
        : 'public_googlelive_tasks';

    const started = Date.now();

    for (;;) {
      const rows = await this.ds.query<StatusRow[]>(
        `
        SELECT status, COUNT(*)::int AS cnt
        FROM ${table}
        WHERE id = ANY($1)
        GROUP BY status;
        `,
        [ids],
      );
      let completed = 0;
      let errors = 0;

      for (const row of rows) {
        if (row.status === 'COMPLETED') completed += row.cnt;
        if (row.status === 'ERROR') errors += row.cnt;
      }

      const done = completed + errors;
      if (done >= ids.length) {
        return { completed, errors, still: 0 };
      }

      if (Date.now() - started > timeoutMs) {
        this.log.warn(
          `[${engine}] waitUntilFinishedWithTimeout timeout: completed=${completed}, errors=${errors}`,
        );
        return { completed, errors, still: ids.length - done };
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  /** Универсальный конструктор чеков */
  private async createCheck(params: {
    engine: Engine;
    device: Device;
    type: TestBenchCheckType;
    ok: boolean;
    level: TestBenchCheckLevel;
    message: string;
    phrase?: TestBenchPhrase | null;
    payload?: Record<string, unknown> | null;
    createdAt?: Date;
  }): Promise<TestBenchCheck> {
    const check = this.checksRepo.create({
      engine: params.engine,
      device: params.device,
      type: params.type,
      ok: params.ok,
      level: params.level,
      message: params.message,
      phrase: params.phrase ?? null,
      phraseId: params.phrase?.id ?? null,
      phraseText: params.phrase?.phrase ?? null,
      payload: params.payload ?? null,
      createdAt: params.createdAt ?? new Date(),
    });

    return this.checksRepo.save(check);
  }

  /** Логика проверки "адекватности" позиций (site missing / jump >= 10) */
  private async evaluatePositionChecks(
    engine: Engine,
    device: Device,
    phrase: TestBenchPhrase,
    site: string,
    currentPosition: number | null,
    testTs: Date = new Date(),
    cfg: TestBenchEngineConfig,
  ): Promise<void> {
    const lookback = new Date(
      Date.now() - this.positionTestLookBackDays * 24 * 60 * 60 * 1000,
    );

    const prev = await this.positionsRepo
      .createQueryBuilder('p')
      .where('p.engine = :engine', { engine })
      .andWhere('p.device = :device', { device })
      .andWhere('p.phraseId = :phraseId', { phraseId: phrase.id })
      .andWhere('p.site = :site', { site })
      .andWhere('p.collectedAt >= :from', { from: lookback })
      .orderBy('p.collectedAt', 'DESC')
      .getOne();

    if (!prev) return;

    const prevPos = prev.position;
    const currPos = currentPosition;

    if (
      prevPos !== null &&
      prevPos >= 1 &&
      prevPos <= 5 &&
      (currPos === null || currPos > this.top)
    ) {
      await this.createCheck({
        engine,
        device,
        type: 'position_site_missing',
        ok: false,
        level: 'warning',
        phrase,
        message: `[${engine}] Site "${site}" disappeared from TOP-5 for phrase "${phrase.phrase}" (prev=${prevPos}, curr=${currPos ?? 'null'})`,
        payload: {
          site,
          prevPosition: prevPos,
          currentPosition: currPos,
          top: this.top,
        },
        createdAt: testTs,
      });
    }

    if (prevPos !== null && currPos !== null) {
      const diff = Math.abs(prevPos - currPos);
      if (diff >= cfg.positionJumpDiffWarning) {
        await this.createCheck({
          engine,
          device,
          type: 'position_jump',
          ok: false,
          level: 'warning',
          phrase,
          message: `[${engine}] Position jump >= ${cfg.positionJumpDiffWarning} for phrase "${phrase.phrase}" (prev=${prevPos}, curr=${currPos}, diff=${diff})`,
          payload: {
            site,
            prevPosition: prevPos,
            currentPosition: currPos,
            diff,
            threshold: cfg.positionJumpDiffWarning,
          },
          createdAt: testTs,
        });
      }
    }
  }

  /** Отчёт от BAS по селекторам */
  async saveSelectorReport(dto: SelectorReportDto): Promise<TestBenchCheck> {
    const run = await this.resolveSelectorRunForReport(dto);
    const reportCreatedAt =
      run?.startedAt ?? this.currentSelectorTestTs ?? new Date();

    const phraseEntity = await this.phrasesRepo.findOne({
      where: { phrase: dto.phrase },
    });

    const typeNoRes: TestBenchCheckType = dto.noResults
      ? 'selectors_no_results'
      : 'selectors_has_results';

    await this.createCheck({
      engine: dto.engine,
      device: dto.device,
      type: typeNoRes,
      ok: true,
      level: 'info',
      phrase: phraseEntity ?? undefined,
      message: `[${dto.engine}] noResults=${dto.noResults} for phrase "${dto.phrase}"`,
      payload: {
        phrase: dto.phrase,
        noResults: dto.noResults,
        comment: dto.comment ?? null,
        runId: run?.id ?? null,
        taskId: dto.taskId ?? null,
      },
      createdAt: reportCreatedAt,
    });

    const checkUrl = await this.createCheck({
      engine: dto.engine,
      device: dto.device,
      type: 'selectors_url_selector_bad',
      ok: dto.urlSelectorOk,
      level: dto.urlSelectorOk ? 'info' : 'error',
      phrase: phraseEntity ?? undefined,
      message: dto.urlSelectorOk
        ? `[${dto.engine}] URL selector OK for phrase "${dto.phrase}"`
        : `[${dto.engine}] URL selector FAILED for phrase "${dto.phrase}"`,
      payload: {
        phrase: dto.phrase,
        urlSelectorOk: dto.urlSelectorOk,
        comment: dto.comment ?? null,
        runId: run?.id ?? null,
        taskId: dto.taskId ?? null,
      },
      createdAt: reportCreatedAt,
    });

    if (!run) return checkUrl;
    if (run.completed) return checkUrl;

    const isNo = dto.noResults;
    const eng = dto.engine;

    if (eng === 'yandex' && isNo) run.yandexNoResOk = dto.urlSelectorOk;
    if (eng === 'yandex' && !isNo) run.yandexHasResOk = dto.urlSelectorOk;

    if (eng === 'google' && isNo) run.googleNoResOk = dto.urlSelectorOk;
    if (eng === 'google' && !isNo) run.googleHasResOk = dto.urlSelectorOk;

    const allDone =
      run.yandexNoResOk !== null &&
      run.yandexHasResOk !== null &&
      run.googleNoResOk !== null &&
      run.googleHasResOk !== null;

    if (allDone) {
      run.completed = true;
      run.finishedAt = new Date();
      await this.selectorRunsRepo.save(run);
      await this.cleanupSelectorRunTasks(run.taskIds);
      this.currentSelectorTestTs = null;
      this.log.log(
        `🎉 [SelectorTest] completed: y-no=${run.yandexNoResOk}, y-has=${run.yandexHasResOk}, g-no=${run.googleNoResOk}, g-has=${run.googleHasResOk}`,
      );
    } else {
      await this.selectorRunsRepo.save(run);
    }

    return checkUrl;
  }

  private async resolveSelectorRunForReport(
    dto: SelectorReportDto,
  ): Promise<TestBenchSelectorRun | null> {
    if (typeof dto.runId === 'number' && Number.isInteger(dto.runId)) {
      const byId = await this.selectorRunsRepo.findOne({
        where: { id: dto.runId },
      });
      if (byId) return byId;
    }

    if (typeof dto.taskId === 'number' && Number.isInteger(dto.taskId)) {
      const byTaskId = await this.selectorRunsRepo
        .createQueryBuilder('r')
        .where(
          `
          COALESCE(r."taskIds"->'yandex', '[]'::jsonb) @> :taskIdJson::jsonb
          OR COALESCE(r."taskIds"->'google', '[]'::jsonb) @> :taskIdJson::jsonb
          `,
          { taskIdJson: JSON.stringify([dto.taskId]) },
        )
        .orderBy('r.startedAt', 'DESC')
        .getOne();

      if (byTaskId) return byTaskId;
    }

    const open = await this.selectorRunsRepo.findOne({
      where: { completed: false },
      order: { id: 'DESC' },
    });
    if (open) return open;

    const cutoff = new Date(Date.now() - this.selectorReportAttachWindowMs);
    return this.selectorRunsRepo.findOne({
      where: { startedAt: MoreThanOrEqual(cutoff) },
      order: { id: 'DESC' },
    });
  }

  /** Список чеков для админки */
  async getChecks(params: {
    engine?: 'yandex' | 'google' | 'all';
    days?: number;
  }): Promise<TestBenchCheck[]> {
    const days = params.days ?? 5;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const qb = this.checksRepo
      .createQueryBuilder('c')
      .where('c.createdAt >= :cutoff', { cutoff })
      .orderBy('c.createdAt', 'DESC');

    if (params.engine && params.engine !== 'all') {
      qb.andWhere('c.engine = :engine', { engine: params.engine });
    }

    return qb.getMany();
  }

  /** Агрегация по позициям для графика (по часам) */
  async getPositionSummary(params: { engine: Engine; days?: number }) {
    const days = params.days ?? 5;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    interface SummaryRow {
      ts: string;
      samples: number;
      missing: number;
      avg_position: number | null;
    }

    const rows = await this.positionsRepo.query<SummaryRow[]>(
      `
      SELECT
        DATE_TRUNC('hour', "collectedAt")
          + FLOOR(EXTRACT(minute FROM "collectedAt") / 5) * INTERVAL '5 minutes'
          AS ts,
        COUNT(*)::int AS samples,
        COUNT(*) FILTER (WHERE position IS NULL)::int AS missing,
        AVG(position) FILTER (WHERE position IS NOT NULL)::float AS avg_position
      FROM test_bench_positions
      WHERE engine = $1
        AND "collectedAt" >= $2
      GROUP BY 1
      ORDER BY ts ASC;
      `,
      [params.engine, cutoff],
    );

    return rows.map((r) => ({
      ts: r.ts,
      samples: r.samples,
      missing: r.missing,
      avgPosition: r.avg_position,
    }));
  }

  private async createSelectorTask(
    engine: Engine,
    phrase: string,
    lr: number,
    device: Device,
  ): Promise<number[]> {
    const payload = {
      query: phrase,
      lr,
      device,
      groupby: 10,
    };
    const task =
      engine === 'yandex'
        ? await this.yandex.create(this.userId, payload)
        : await this.google.create(this.userId, payload);

    return [task.id];
  }

  private async hasRecentSelectorFailureBefore(
    engine: Engine,
    before: Date,
  ): Promise<boolean> {
    const since = new Date(
      before.getTime() - this.selectorFailureConfirmationWindowMs,
    );

    const prev = await this.checksRepo
      .createQueryBuilder('c')
      .where('c.engine = :engine', { engine })
      .andWhere('c.type = :type', { type: 'selectors_url_selector_bad' })
      .andWhere('c.ok = false')
      .andWhere('c.createdAt >= :since', { since })
      .andWhere('c.createdAt < :before', { before })
      .orderBy('c.createdAt', 'DESC')
      .getOne();

    return Boolean(prev);
  }

  /** Запуск теста селекторов (4 задачи: Yandex/Google × nores/hasres) */
  private async runSelectorsTest(testTs: Date = new Date()): Promise<void> {
    this.log.log('🧪 [SelectorTest] started');
    await this.cleanupOldSelectorPublicApiTasks();

    const run = this.selectorRunsRepo.create({
      startedAt: testTs,
      completed: false,
      taskIds: null,
    });
    this.currentSelectorTestTs = testTs;
    await this.selectorRunsRepo.save(run);

    const phrases = await this.phrasesRepo.find({
      where: { active: true, type: 'selector' },
      order: { id: 'ASC' },
      take: 10,
    });

    if (phrases.length < 2) {
      run.error = 'Недостаточно фраз типа selector';
      run.completed = true;
      run.finishedAt = testTs;
      await this.selectorRunsRepo.save(run);
      return;
    }

    const noRes = phrases[0].phrase;
    const hasRes = phrases[1].phrase;
    const devices: Device[] = ['desktop', 'mobile'];

    const created = {
      yandexNo: [] as number[],
      yandexHas: [] as number[],
      googleNo: [] as number[],
      googleHas: [] as number[],
    };

    for (const dev of devices) {
      created.yandexNo.push(
        ...(await this.createSelectorTask('yandex', noRes, this.lrYandex, dev)),
      );
      created.yandexHas.push(
        ...(await this.createSelectorTask(
          'yandex',
          hasRes,
          this.lrYandex,
          dev,
        )),
      );
      created.googleNo.push(
        ...(await this.createSelectorTask('google', noRes, this.lrGoogle, dev)),
      );
      created.googleHas.push(
        ...(await this.createSelectorTask(
          'google',
          hasRes,
          this.lrGoogle,
          dev,
        )),
      );
    }

    run.taskIds = {
      yandex: [...created.yandexNo, ...created.yandexHas],
      google: [...created.googleNo, ...created.googleHas],
    };
    await this.selectorRunsRepo.save(run);

    this.log.log(`🧪 [SelectorTest] tasks created: ${JSON.stringify(created)}`);

    await this.waitUntilFinishedWithTimeout(
      'yandex',
      [...created.yandexNo, ...created.yandexHas],
      10 * 60 * 1000,
    );
    await this.waitUntilFinishedWithTimeout(
      'google',
      [...created.googleNo, ...created.googleHas],
      10 * 60 * 1000,
    );

    this.log.log('🧪 [SelectorTest] waiting for BAS reports...');
  }

  async getSelectorRuns(limit = 100): Promise<TestBenchSelectorRun[]> {
    const safeLimit = Math.max(1, Math.min(500, limit));

    return this.selectorRunsRepo.find({
      order: { startedAt: 'DESC' },
      take: safeLimit,
    });
  }

  /** Сырые позиции по тестовому сайту (для таблицы / матрицы) */
  async getPositions(params: { engine: Engine; days?: number }): Promise<
    {
      id: number;
      engine: TestBenchPositionEngine;
      device: TestBenchPositionDevice;
      collectedAt: Date;
      phraseId: number;
      phraseText: string;
      site: string;
      position: number | null;
    }[]
  > {
    const days = params.days ?? this.positionTestLookBackDays;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.positionsRepo.find({
      where: {
        engine: params.engine,
        collectedAt: MoreThanOrEqual(cutoff),
      },
      order: { collectedAt: 'DESC' },
      relations: { phrase: true },
    });

    return rows.map((p) => ({
      id: p.id,
      engine: p.engine,
      device: p.device,
      collectedAt: p.collectedAt,
      phraseId: p.phraseId,
      phraseText: p.phraseText ?? p.phrase?.phrase ?? '',
      site: p.site,
      position: p.position,
    }));
  }

  private async evaluateGlobalChecks(testTs: Date): Promise<void> {
    const checks = await this.checksRepo.find({
      where: { createdAt: testTs },
    });

    for (const engine of ['yandex', 'google'] as const) {
      const cfg = await this.getEngineConfig(engine);

      const bad = checks.filter((c) => c.engine === engine && c.ok === false);
      if (bad.length === 0) continue;

      const reasons: string[] = [];

      if (
        bad.some((c) => c.type === 'positions_missing_many') &&
        cfg.autoblockPositionsMissing
      ) {
        reasons.push('слишком много пропусков');
      }

      if (
        bad.some((c) => c.type === 'position_jump') &&
        cfg.autoblockPositionsJump
      ) {
        reasons.push('резкие скачки позиций');
      }

      if (
        bad.some((c) => c.type === 'selectors_url_selector_bad') &&
        cfg.autoblockSelectors
      ) {
        const confirmed = await this.hasRecentSelectorFailureBefore(
          engine,
          testTs,
        );

        if (confirmed) {
          reasons.push('ошибки селекторов подтверждены повторным прогоном');
        } else {
          this.log.warn(
            `[SelectorTest][${engine}] selector failure is treated as a first flake; waiting for the next run before autoblock/critical alert`,
          );
        }
      }

      /* -----------------------------
       * 1) Если автоблок включён — блокируем + алерт
       * ----------------------------- */
      if (cfg.autoblockEnabled && reasons.length > 0) {
        const reasonText = `Autoblock: ${reasons.join(', ')}`;

        await this.setEngineBlocked(engine, true, reasonText);

        if (cfg.telegramAlertsEnabled) {
          this.sendTelegramAlert(`🚫 ${engine} заблокирован: ${reasonText}`);
        }

        continue;
      }

      /* -----------------------------
       * 2) Если автоблок выключен, но alert включён —
       * отправляем предупреждение без блокировки
       * ----------------------------- */
      if (
        !cfg.autoblockEnabled &&
        cfg.telegramAlertsEnabled &&
        bad.length > 0
      ) {
        const text = [
          `⚠️ Обнаружены критические проблемы для ${engine},`,
          `но autoblock выключен.`,
          ``,
          `Проблемы:`,
          ...bad.map((c) => `• ${c.type}: ${c.message}`),
        ].join('\n');

        this.sendTelegramAlert(text);
      }
    }
  }

  private async blockEngine(engine: 'yandex' | 'google', reason: string) {
    await this.ds.query(
      `
      INSERT INTO test_bench_engine_block (engine, blocked, reason)
      VALUES ($1, true, $2)
      ON CONFLICT (engine) DO UPDATE
      SET blocked = true,
          reason  = $2;
      `,
      [engine, reason],
    );
  }

  async isEngineBlocked(engine: 'yandex' | 'google'): Promise<boolean> {
    type Row = { blocked: boolean };

    const rows = await this.ds.query<Row[]>(
      `SELECT blocked FROM test_bench_engine_block WHERE engine = $1`,
      [engine],
    );

    // rows может быть any → мы обрабатываем безопасно
    const row = Array.isArray(rows) ? rows[0] : undefined;

    return row?.blocked === true;
  }

  async setEngineBlocked(
    engine: 'yandex' | 'google',
    blocked: boolean,
    reason?: string,
  ): Promise<void> {
    // --- Parsec local update ---
    if (blocked) {
      await this.ds.query(
        `
      INSERT INTO test_bench_engine_block (engine, blocked, reason)
      VALUES ($1, true, $2)
      ON CONFLICT (engine)
      DO UPDATE SET blocked = true, reason = $2
      `,
        [engine, reason ?? 'manual'],
      );
    } else {
      await this.ds.query(
        `UPDATE test_bench_engine_block SET blocked = false, reason = null WHERE engine = $1`,
        [engine],
      );
    }

    // --- propagate to RankScan (best-effort, never throw) ---
    const ok = await this.rankScanLock.setStatus({ [engine]: blocked });
    if (!ok) {
      this.log.warn(`Failed to sync RankScan lock for ${engine}=${blocked}`);
    }
  }

  @Cron('*/2 * * * *', { timeZone: 'Europe/Moscow' })
  async syncRankScanLock(): Promise<void> {
    const remote = await this.rankScanLock.getStatus();
    if (!remote) return; // нет связи с RankScan → тихо выходим

    const localY = await this.isEngineBlocked('yandex');
    const localG = await this.isEngineBlocked('google');

    const patch: Partial<RankScanLockState> = {};

    if (remote.yandex !== localY) patch.yandex = localY;
    if (remote.google !== localG) patch.google = localG;

    if (Object.keys(patch).length === 0) return;

    const ok = await this.rankScanLock.setStatus(patch);

    if (ok) {
      this.log.log(`Synced RankScan parser-lock: ${JSON.stringify(patch)}`);
    } else {
      this.log.warn(
        `Failed to sync RankScan parser-lock: ${JSON.stringify(patch)}`,
      );
    }
  }

  async sendCaptchaMetricsReport(): Promise<void> {
    const metrics = await this.rankScanLock.getMetrics();
    if (!metrics) {
      this.sendCaptchaMetricsAlert(
        '❌ Не удалось получить капча-метрики с RankScan',
      );
      return;
    }

    const now = new Date();

    for (const [serverId, engines] of Object.entries(metrics)) {
      for (const engine of ['yandex', 'google'] as const) {
        const e = engines[engine];
        if (!e) continue;

        for (const device of ['desktop', 'mobile'] as const) {
          const d = e[device];
          if (!d) continue;

          // RankScan отдаёт только ненулевые значения
          const values = d.values ?? [];

          // Кол-во нулевых капч присылается отдельно
          const zeroCaptchaCount = d.zeroCaptchaCount ?? 0;

          // Общее количество замеров = нули + ненули
          const samplesTotal = zeroCaptchaCount + values.length;

          // Ненулевые значения
          const nonZeroValues = values;

          // Среднее по НЕ нулевым
          const avgNonZero =
            nonZeroValues.length === 0
              ? 0
              : nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length;

          // Процент нулевых капч
          const zeroPercent =
            samplesTotal === 0 ? 0 : (zeroCaptchaCount / samplesTotal) * 100;

          // Гистограмма по ненулевым значениям
          const histogram: Record<string, number> = {};
          for (const v of values) {
            histogram[v] = (histogram[v] ?? 0) + 1;
          }

          // Сохраняем метрику
          await this.captchaService.saveMetric({
            serverId,
            engine,
            device,

            zeroCaptchaCount,
            avgTotal: d.avg ?? 0,
            avgNonZero,

            samplesTotal,
            samplesNonZero: nonZeroValues.length,

            zeroPercent,
            histogram,

            collectedAt: now,
          });

          // Проверка критериев (детект аномалий)
          await this.checkCaptchaCriteria(serverId, engine, device, {
            avgNonZero,
            zeroPercent,
          });
        }
      }
    }

    // Чистим буфер RankScan
    const ok = await this.rankScanLock.clearMetrics();

    // Удаляем только старые записи (30 дней), не всё!
    await this.captchaService.cleanupOld();

    this.log.log('Капча-метрики отправлены в базу данных');

    if (!ok) {
      this.log.warn('❌ Не удалось очистить капча-метрики после отчёта');
    }
  }

  private async checkCaptchaCriteria(
    serverId: string,
    engine: 'yandex' | 'google',
    device: 'desktop' | 'mobile',
    m: { avgNonZero: number; zeroPercent: number },
  ): Promise<void> {
    const cfg = await this.engineConfigRepo.findOne({ where: { engine } });
    if (!cfg) return;

    const isDesktop = device === 'desktop';

    /** ===== СТАРЫЕ ЛИМИТЫ (максимальные пороги) ===== */

    // Максимальные avgNonZero
    const maxAvgLimit = isDesktop
      ? cfg.captchaAvgNonZeroLimitDesktop
      : cfg.captchaAvgNonZeroLimitMobile;

    // Максимальный zeroPercent
    const maxZeroLimit = isDesktop
      ? cfg.captchaZeroPercentLimitDesktop
      : cfg.captchaZeroPercentLimitMobile;

    // Включены ли алерты для старой логики
    const alertsEnabled = cfg.captchaAlertsEnabled;

    /** ===== НОВЫЕ ЛИМИТЫ (минимальные пороги avgNonZero) ===== */

    const minAvgLimit = isDesktop
      ? cfg.captchaAvgNonZeroMinDesktop
      : cfg.captchaAvgNonZeroMinMobile;

    const minAvgEnabled = cfg.captchaMinAvgAlertEnabled;

    /** ===== СБОР ПРОБЛЕМ ===== */

    const oldProblems: string[] = [];
    const newProblems: string[] = [];

    /* --- Старые проверки (максимальные лимиты) --- */

    if (maxAvgLimit > 0 && m.avgNonZero > maxAvgLimit) {
      oldProblems.push(
        `avgNonZero=${m.avgNonZero.toFixed(
          2,
        )} превысил лимит ${maxAvgLimit} (${engine}, ${device}, server ${serverId})`,
      );
    }

    if (maxZeroLimit > 0 && m.zeroPercent > maxZeroLimit) {
      oldProblems.push(
        `zeroPercent=${m.zeroPercent.toFixed(
          2,
        )}% превысил лимит ${maxZeroLimit}% (${engine}, ${device}, server ${serverId})`,
      );
    }

    /* --- Новая проверка: avgNonZero слишком маленький --- */

    if (minAvgEnabled && minAvgLimit > 0 && m.avgNonZero < minAvgLimit) {
      newProblems.push(
        `avgNonZero=${m.avgNonZero.toFixed(
          2,
        )} ниже минимального порога ${minAvgLimit} (${engine}, ${device}, server ${serverId})`,
      );
    }

    /** ===== РАССЫЛКА АЛЕРТОВ ===== */

    // Старые алерты по процентам / большим avg
    if (alertsEnabled && oldProblems.length > 0) {
      this.sendCaptchaMetricsAlert(
        `⚠️ Проблемы капча-метрик:\n${oldProblems
          .map((p) => `• ${p}`)
          .join('\n')}`,
      );
    }

    // Новые алерты по слишком маленькому avgNonZero
    if (minAvgEnabled && newProblems.length > 0) {
      this.sendCaptchaMetricsAlert(
        `⚠️ Капча-метрики ниже порога:\n${newProblems
          .map((p) => `• ${p}`)
          .join('\n')}`,
      );
    }
  }

  @Cron('0,1 * * * * *', { timeZone: 'Europe/Moscow' })
  async cronCaptchaScheduler(): Promise<void> {
    // if (process.env.NODE_ENV === 'development') return;

    const now = new Date();
    const msk = new Date(
      now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }),
    );

    const current = msk.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    const minuteKey = current; // для защиты от двойного старта

    // защита от повторного запуска в ту же минуту
    if (this.lastCaptchaRunMinute === minuteKey) return;

    const hh = msk.getHours().toString().padStart(2, '0');
    const mm = msk.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    const cfgs = await this.engineConfigRepo.find();

    const needRun = cfgs.some(
      (cfg) =>
        Array.isArray(cfg.captchaScheduleTimes) &&
        cfg.captchaScheduleTimes.includes(timeStr),
    );

    if (!needRun) return;
    // фиксируем, что эта минута обработана
    this.lastCaptchaRunMinute = minuteKey;

    try {
      await this.sendCaptchaMetricsReport();
      this.log.log(`📊 [CaptchaMetrics] executed at ${timeStr} MSK`);
    } catch (e) {
      const err = e as Error;
      this.log.error(`cronCaptchaScheduler failed: ${err.message}`, err.stack);
    }
  }
}
