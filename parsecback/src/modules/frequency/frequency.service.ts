// src/modules/frequency/frequency.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isStubMode } from '@/common/stub-mode';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FrequencyTask } from './entities/frequency-task.entity';
import { FrequencyChunk } from './entities/frequency-chunk.entity';
import {
  FREQUENCY_SERVICE_CODE,
  mapFrequencyTypeNameToId,
  type FrequencyTypeId,
  FREQUENCY_TYPES,
} from './frequency.constants';
import { KeyTurboClient, type KeyTurboResultItem } from './keyturbo.client';
import {
  ApiOkResponse,
  makeError,
  ERROR_CODES,
  type ApiErrorResponse,
} from './frequency.errors';
import { CreateFrequencyTaskDto } from './dto/create-frequency-task.dto';
import { BillingService } from '@/modules/billing/billing.service';
import { ServicesService } from '../services/services.service';

type CreateResult = ApiErrorResponse | ApiOkResponse<{ taskId: number }>;

type GetResult =
  | ApiErrorResponse
  | ApiOkResponse<{
      task: {
        taskId: number;
        state: 'pending' | 'completed' | 'error';
        progress: number;
        errorCode?: string | null;
        errorMessage?: string | null;
        result?: Array<{
          phrase: string;
          frequencyTypeId: FrequencyTypeId | null;
          frequencyTypeName: string;
          frequency: number;
        }>;
      };
    }>;

// --- КОНСТАНТЫ ---

const CHUNK_SIZE = 50;
const MAX_RETRY_ERRORS = 10;
const MAX_INFLIGHT = 50;

// SQL для round-robin по пользователям
const SQL_COUNT_INFLIGHT = `
  SELECT COUNT(*)::int AS count
  FROM public.frequency_chunks
  WHERE status IN ('SENDING','SENT','POLLING');
`;

const SQL_PICK_RR_TO_SENDING = `
WITH queued AS (
  SELECT
    id,
    "userId",
    "createdAt",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", id) AS rn
  FROM public.frequency_chunks
  WHERE status = 'QUEUED'
),
ordered AS (
  SELECT id
  FROM queued
  ORDER BY rn, "userId", id
  LIMIT $1
),
locked AS (
  SELECT t.id
  FROM public.frequency_chunks t
  JOIN ordered o ON o.id = t.id
  FOR UPDATE SKIP LOCKED
)
UPDATE public.frequency_chunks t
SET status = 'SENDING', "updatedAt" = now()
FROM locked
WHERE t.id = locked.id
RETURNING
  t.id,
  t."userId" AS "user_id",
  t."taskId" AS "task_id",
  t.phrases   AS "phrases";
`;

const SQL_POLL = `
WITH pick AS (
  SELECT id
  FROM public.frequency_chunks
  WHERE status = 'SENT'
    AND ("nextPollAt" IS NULL OR "nextPollAt" <= now())
  ORDER BY "createdAt", id
  FOR UPDATE SKIP LOCKED
  LIMIT $1
)
UPDATE public.frequency_chunks t
SET status = 'POLLING', "updatedAt" = now()
FROM pick
WHERE t.id = pick.id
RETURNING
  t.id,
  t."userId" AS "user_id",
  t."taskId" AS "task_id",
  t."externalTaskId" AS "externalTaskId",
  t."pollRetryCount" AS "pollRetryCount";
`;

// --- ВСПОМОГАТЕЛЬНЫЕ ТИПЫ ДЛЯ SQL ---

interface SqlCountRow {
  count: number | string;
}

/**
 * Как возвращает Postgres:
 *  { id, user_id, task_id, phrases }
 */
interface SqlPickSendingRowRaw {
  id: number;
  user_id: number;
  task_id: number;
  phrases: string[] | string;
}

/**
 * Нормализованный вариант, с которым мы работаем в коде.
 */
interface SqlPickSendingRow {
  id: number;
  userId: number;
  taskId: number;
  phrases: string[];
}

/**
 * Как возвращает Postgres для POLL:
 *  { id, user_id, task_id, externalTaskId, pollRetryCount }
 */
interface SqlPollRowRaw {
  id: number;
  user_id: number;
  task_id: number;
  externalTaskId: number | null;
  pollRetryCount: number | null;
}

/**
 * Нормализованный вариант для кода.
 */
interface SqlPollRow {
  id: number;
  userId: number;
  taskId: number;
  externalTaskId: number | null;
  pollRetryCount: number | null;
}

// --- TYPE GUARDS ---

function isSqlCountRow(row: unknown): row is SqlCountRow {
  if (!row || typeof row !== 'object') return false;
  const r = row as { [key: string]: unknown };
  const v = r.count;
  return (
    typeof v === 'number' || (typeof v === 'string' && v.trim().length > 0)
  );
}

function isPgArrayString(value: string): boolean {
  return value.startsWith('{') && value.endsWith('}');
}

function parsePgArray(value: string): string[] {
  if (!isPgArrayString(value)) return [];
  const inner = value.slice(1, -1);
  if (inner.trim() === '') return [];
  return inner.split(',').map((v) => v.trim());
}

function normalizePhrases(input: string[] | string): string[] {
  if (Array.isArray(input)) {
    return input.filter((p): p is string => typeof p === 'string');
  }
  return parsePgArray(input);
}

/**
 * Guard для "сырых" строк из SQL PICK.
 */
function isSqlPickSendingRowRaw(row: unknown): row is SqlPickSendingRowRaw {
  if (!row || typeof row !== 'object') return false;

  const r = row as Record<string, unknown>;
  const { id, user_id, task_id, phrases } = r;

  if (
    typeof id !== 'number' ||
    typeof user_id !== 'number' ||
    typeof task_id !== 'number'
  ) {
    return false;
  }

  if (Array.isArray(phrases)) {
    return phrases.every((p) => typeof p === 'string');
  }

  if (typeof phrases === 'string') {
    return isPgArrayString(phrases);
  }

  return false;
}

/**
 * Guard для "сырых" строк из SQL POLL.
 */
function isSqlPollRowRaw(row: unknown): row is SqlPollRowRaw {
  if (!row || typeof row !== 'object') return false;

  const r = row as Record<string, unknown>;
  const { id, user_id, task_id, externalTaskId, pollRetryCount } = r;

  const externalOk =
    externalTaskId === null || typeof externalTaskId === 'number';
  const retryOk = pollRetryCount === null || typeof pollRetryCount === 'number';

  return (
    typeof id === 'number' &&
    typeof user_id === 'number' &&
    typeof task_id === 'number' &&
    externalOk &&
    retryOk
  );
}

function isKeyTurboResultItem(value: unknown): value is KeyTurboResultItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as { [key: string]: unknown };

  const phrase = v.phrase;
  const frequencyType = v.frequencyType;
  const frequency = v.frequency;

  const freqOk =
    typeof frequency === 'number' ||
    typeof frequency === 'string' ||
    frequency === null ||
    typeof frequency === 'undefined';

  return (
    typeof phrase === 'string' && typeof frequencyType === 'string' && freqOk
  );
}

// --- СЕРВИС ---

@Injectable()
export class FrequencyService {
  private readonly log = new Logger(FrequencyService.name);

  constructor(
    @InjectRepository(FrequencyTask)
    private readonly taskRepo: Repository<FrequencyTask>,
    @InjectRepository(FrequencyChunk)
    private readonly chunkRepo: Repository<FrequencyChunk>,
    private readonly ds: DataSource,
    private readonly keyturbo: KeyTurboClient,
    private readonly billing: BillingService,
    private readonly services: ServicesService,
    private readonly config: ConfigService,
  ) {}

  private extractErrMsg(error: unknown): string {
    if (typeof error === 'string') return error;

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return '';
  }

  /**
   * Получить LR:
   * 1) если передан dto.region_key → использовать его
   * 2) иначе взять из service_settings(FREQUENCY)
   * 3) иначе дефолт 225
   */
  private async resolveCity(
    userId: number,
    regionKey?: number,
  ): Promise<number> {
    // 1) передан в запросе
    if (Number.isInteger(regionKey) && regionKey! > 0) {
      return regionKey!;
    }

    // 2) settings FREQUENCY
    const settings = await this.services.getSettingsByCode(
      userId,
      FREQUENCY_SERVICE_CODE,
    );

    const fromSettings = (() => {
      if (!settings) return null;
      const raw = settings['lr'];
      const v = Number(raw);
      return Number.isInteger(v) && v > 0 ? v : null;
    })();

    if (fromSettings !== null) return fromSettings;

    // 3) дефолт
    return 225;
  }

  private normalizeFrequencyTypes(
    types?: FrequencyTypeId[] | null,
  ): FrequencyTypeId[] {
    if (!types || types.length === 0) return [1];

    const unique = Array.from(
      new Set(
        types
          .map((t) => Number(t) as FrequencyTypeId)
          .filter((t) => FREQUENCY_TYPES.some((ft) => ft.id === t)),
      ),
    );

    return unique.length > 0 ? unique : [1];
  }

  private sanitizePhrase(s: string): string {
    return s.trim();
  }

  // private clampCity(city?: number): number {
  //   if (!city || !Number.isFinite(city)) return 225;
  //   const v = Math.trunc(city);
  //   return v > 0 ? v : 225;
  // }

  private async countInflight(): Promise<number> {
    const raw: unknown = await this.ds.query(SQL_COUNT_INFLIGHT);

    if (!Array.isArray(raw) || raw.length === 0) {
      return 0;
    }

    const first: unknown = raw[0]; // избегаем unsafe-assignment

    if (!isSqlCountRow(first)) {
      return 0;
    }

    const value = first.count;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // --- ПУБЛИЧНЫЙ МЕТОД СОЗДАНИЯ ЗАДАЧИ ---

  async createTask(
    userId: number,
    dto: CreateFrequencyTaskDto,
    softId: string | null,
  ): Promise<CreateResult> {
    if (isStubMode(this.config)) {
      return makeError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Создание задач временно недоступно: сервис на техническом обслуживании',
      );
    }

    // wordstat пока не реализован
    if (dto.type === 'wordstat') {
      return makeError(
        ERROR_CODES.WORDSTAT_NOT_IMPLEMENTED,
        'Сервис Wordstat ещё не реализован',
      );
    }

    // базовые проверки
    if (!dto.keywords || dto.keywords.length === 0) {
      return makeError(
        ERROR_CODES.MISSING_PARAM,
        'Не передан список фраз (keywords)',
      );
    }

    const phrases = dto.keywords
      .map((p) => this.sanitizePhrase(p))
      .filter((p) => p.length > 0);

    if (phrases.length === 0) {
      return makeError(ERROR_CODES.EMPTY_QUERY, 'Все переданные фразы пустые');
    }

    // const city = this.clampCity(dto.region_key);
    // if (!Number.isFinite(city) || city <= 0) {
    //   return makeError(ERROR_CODES.INVALID_CITY, 'Неверный код региона (city)');
    // }
    let city: number;

    if (dto.region_key !== undefined) {
      const v = Number(dto.region_key);
      if (!Number.isInteger(v) || v <= 0) {
        return makeError(
          ERROR_CODES.INVALID_CITY,
          'Неверный код региона (region_key)',
        );
      }
      city = v;
    } else {
      city = await this.resolveCity(userId);
    }

    const frequencyTypes = this.normalizeFrequencyTypes(dto.frequencyTypes);
    if (!frequencyTypes.length) {
      return makeError(
        ERROR_CODES.INVALID_FREQUENCY_TYPE,
        'Не указаны корректные типы частот',
      );
    }

    const phrasesTotal = phrases.length;
    const units = phrasesTotal * frequencyTypes.length;

    // биллинг: проверяем и списываем сразу
    const pre = await this.billing.precheckFunds(
      userId,
      FREQUENCY_SERVICE_CODE,
      units,
    );
    if (!pre.ok) {
      return makeError(
        ERROR_CODES.INSUFFICIENT_FUNDS,
        'Недостаточно средств на балансе',
      );
    }

    await this.billing.charge(
      userId,
      FREQUENCY_SERVICE_CODE,
      units,
      `Frequency: ${phrasesTotal} фраз × ${frequencyTypes.length} типов частот`,
      softId ?? null,
    );

    // создаём таск + чанки
    const minusWords =
      dto.minusWords?.map((w) => w.trim()).filter((w) => w.length > 0) ?? null;
    const yearlyFrequency = Boolean(dto.yearlyFrequency);

    const task = this.taskRepo.create({
      userId,
      type: 'frequency',
      city,
      phrases,
      minusWords,
      yearlyFrequency,
      frequencyTypes,
      chunksTotal: 0, // пересчитаем ниже
      chunksCompleted: 0,
      status: 'QUEUED',
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      resultFetchedAt: null,
      softId: softId ?? null,
    });

    await this.ds.transaction(async (trx) => {
      const tRepo = trx.getRepository(FrequencyTask);
      const cRepo = trx.getRepository(FrequencyChunk);

      const savedTask = await tRepo.save(task);

      const chunks: FrequencyChunk[] = [];
      for (let i = 0; i < phrases.length; i += CHUNK_SIZE) {
        const slice = phrases.slice(i, i + CHUNK_SIZE);
        const chunk = cRepo.create({
          userId,
          taskId: savedTask.id,
          phrases: slice,
          externalTaskId: null,
          status: 'QUEUED',
          error: null,
          pollRetryCount: 0,
          nextPollAt: null,
          result: null,
          completedAt: null,
        });
        chunks.push(chunk);
      }

      await cRepo.save(chunks);

      savedTask.chunksTotal = chunks.length;
      savedTask.status = chunks.length > 0 ? 'QUEUED' : 'COMPLETED';
      await tRepo.save(savedTask);

      task.id = savedTask.id;
      task.chunksTotal = savedTask.chunksTotal;
    });

    return {
      status: 'ok',
      taskId: task.id,
    };
  }

  // --- ПУБЛИЧНЫЙ МЕТОД ПОЛУЧЕНИЯ СТАТУСА/РЕЗУЛЬТАТА ---

  async getTask(userId: number, taskId: number): Promise<GetResult> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      return makeError(ERROR_CODES.BAD_VALUE, 'Задача не найдена');
    }

    // если задача ещё в процессе
    if (task.status === 'QUEUED' || task.status === 'RUNNING') {
      const completedChunks = await this.chunkRepo.count({
        where: { taskId: task.id, status: 'COMPLETED' },
      });

      const progress =
        task.chunksTotal > 0
          ? Math.round((completedChunks / task.chunksTotal) * 100)
          : 0;

      // если хотя бы один чанк уже завершён, считаем, что RUNNING
      if (task.status === 'QUEUED' && completedChunks > 0) {
        task.status = 'RUNNING';
        await this.taskRepo.save(task);
      }

      return {
        status: 'ok',
        task: {
          taskId: task.id,
          state: 'pending',
          progress,
        },
      };
    }

    // если ошибка
    if (task.status === 'ERROR') {
      const progress =
        task.chunksTotal > 0
          ? Math.round((task.chunksCompleted / task.chunksTotal) * 100)
          : 0;

      return {
        status: 'ok',
        task: {
          taskId: task.id,
          state: 'error',
          progress,
          errorCode: task.errorCode,
          errorMessage: task.errorMessage,
        },
      };
    }

    // COMPLETED — собираем результаты, отдаём и удаляем
    const chunks = await this.chunkRepo.find({
      where: { taskId: task.id, status: In(['COMPLETED']) },
    });

    const merged: KeyTurboResultItem[] = [];

    for (const ch of chunks) {
      const resultRaw: unknown = ch.result;
      if (!Array.isArray(resultRaw)) continue;

      for (const item of resultRaw) {
        if (isKeyTurboResultItem(item)) {
          merged.push(item);
        }
      }
    }

    const result = merged.map((item) => {
      const freqTypeId = mapFrequencyTypeNameToId(item.frequencyType);
      const freqValueRaw = item.frequency;

      const freqValue =
        typeof freqValueRaw === 'number'
          ? freqValueRaw
          : typeof freqValueRaw === 'string'
            ? Number.parseInt(freqValueRaw, 10)
            : 0;

      return {
        phrase: item.phrase,
        frequencyTypeId: freqTypeId,
        frequencyTypeName: item.frequencyType,
        frequency: Number.isFinite(freqValue) ? freqValue : 0,
      };
    });

    // помечаем, что клиент забрал результат и удаляем задачу
    await this.ds.transaction(async (trx) => {
      const tRepo = trx.getRepository(FrequencyTask);
      const cRepo = trx.getRepository(FrequencyChunk);

      const ent = await tRepo.findOne({
        where: { id: task.id, userId },
      });

      if (!ent) return;

      ent.resultFetchedAt = new Date();
      await tRepo.save(ent);

      await cRepo.delete({ taskId: ent.id });
      await tRepo.delete({ id: ent.id });
    });

    return {
      status: 'ok',
      task: {
        taskId: task.id,
        state: 'completed',
        progress: 100,
        result,
      },
    };
  }

  // --- ВНУТРЕННИЙ КОНВЕЙЕР: PUSH QUEUED -> KeyTurbo ---

  /**
   * Раз в N секунд забираем чанки в статусе QUEUED, создаём задачи в KeyTurbo.
   * Round-robin по userId, ограничение MAX_INFLIGHT.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pushQueued(): Promise<void> {
    try {
      const inflight = await this.countInflight();
      const free = Math.max(0, MAX_INFLIGHT - inflight);

      if (free <= 0) return;

      const raw: unknown = await this.ds.query(SQL_PICK_RR_TO_SENDING, [free]);

      const sqlRows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : [];
      const rows: SqlPickSendingRow[] = sqlRows
        .filter(isSqlPickSendingRowRaw)
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          taskId: r.task_id,
          phrases: normalizePhrases(r.phrases),
        }));

      for (const r of rows) {
        const chunkId = r.id;
        const taskId = r.taskId;
        const phrases = r.phrases;

        const chunk = await this.chunkRepo.findOne({
          where: { id: chunkId },
        });
        const task = await this.taskRepo.findOne({
          where: { id: taskId },
        });

        if (!chunk || !task) {
          continue;
        }

        try {
          const data = await this.keyturbo.createTask({
            city: task.city,
            phrases,
            type: 'frequency',
            frequencyType: task.frequencyTypes,
            minusWords: task.minusWords ?? undefined,
            yearlyFrequency: task.yearlyFrequency,
          });

          chunk.externalTaskId = data.taskId;
          chunk.status = 'SENT';
          chunk.error = null;
          chunk.pollRetryCount = 0;
          chunk.nextPollAt = null;

          // Обновим статус задачи
          if (task.status === 'QUEUED') {
            task.status = 'RUNNING';
          }

          await this.ds.transaction(async (trx) => {
            await trx.getRepository(FrequencyChunk).save(chunk);
            await trx.getRepository(FrequencyTask).save(task);
          });
        } catch (err) {
          const msg = this.extractErrMsg(err);

          this.log.warn(
            `pushQueued: failed for chunk #${chunkId}, task #${taskId}: ${msg}`,
          );

          // попробуем несколько раз. Если совсем не получается — ставим ERROR
          chunk.pollRetryCount += 1;
          if (chunk.pollRetryCount >= MAX_RETRY_ERRORS) {
            chunk.status = 'ERROR';
            chunk.error = 'create_failed';
            chunk.completedAt = new Date();

            // Задачу пометим ошибочной
            task.status = 'ERROR';
            task.errorCode = 'create_failed';
            task.errorMessage = 'Не удалось создать задачу в сервисе частот';
            task.completedAt = new Date();

            await this.ds.transaction(async (trx) => {
              await trx.getRepository(FrequencyChunk).save(chunk);
              await trx.getRepository(FrequencyTask).save(task);
            });
          } else {
            // вернём в QUEUED, через следующий цикл попробуем ещё
            chunk.status = 'QUEUED';
            await this.chunkRepo.save(chunk);
          }
        }
      }
    } catch (err) {
      const msg = this.extractErrMsg(err);
      this.log.error(`pushQueued: fatal error: ${msg}`);
    }
  }

  // --- ПОЛЛИНГ KeyTurbo ---

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollSent(): Promise<void> {
    try {
      const raw: unknown = await this.ds.query(SQL_POLL, [MAX_INFLIGHT]);

      const sqlRowsRaw: unknown[] =
        Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : [];

      const rows: SqlPollRow[] = sqlRowsRaw
        .filter(isSqlPollRowRaw)
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          taskId: r.task_id,
          externalTaskId: r.externalTaskId,
          pollRetryCount: r.pollRetryCount,
        }));

      for (const r of rows) {
        const chunkId = r.id;
        const taskId = r.taskId;
        const externalTaskId = r.externalTaskId;
        const prevRetries = r.pollRetryCount ?? 0;

        const chunk = await this.chunkRepo.findOne({
          where: { id: chunkId },
        });
        const task = await this.taskRepo.findOne({
          where: { id: taskId },
        });

        if (!chunk || !task) continue;

        if (!externalTaskId) {
          chunk.status = 'ERROR';
          chunk.error = 'missing_externalTaskId';

          task.status = 'ERROR';
          task.errorCode = 'missing_externalTaskId';
          task.errorMessage = 'Не получен идентификатор задачи KeyTurbo';
          task.completedAt = new Date();

          await this.ds.transaction(async (trx) => {
            await trx.getRepository(FrequencyChunk).save(chunk);
            await trx.getRepository(FrequencyTask).save(task);
          });
          continue;
        }

        const resp = await this.keyturbo.getResult(externalTaskId);
        if (!resp) {
          // ошибка сети или KeyTurbo
          const nextRetries = prevRetries + 1;
          if (nextRetries >= MAX_RETRY_ERRORS) {
            chunk.status = 'ERROR';
            chunk.error = 'poll_failed';
            chunk.completedAt = new Date();

            task.status = 'ERROR';
            task.errorCode = 'poll_failed';
            task.errorMessage = 'Не удалось получить результат задачи частот';
            task.completedAt = new Date();

            await this.ds.transaction(async (trx) => {
              await trx.getRepository(FrequencyChunk).save(chunk);
              await trx.getRepository(FrequencyTask).save(task);
            });
          } else {
            const nextPollAt = new Date(
              Date.now() + 3000 + Math.floor(Math.random() * 4000),
            );
            chunk.status = 'SENT';
            chunk.nextPollAt = nextPollAt;
            chunk.pollRetryCount = nextRetries;
            await this.chunkRepo.save(chunk);
          }
          continue;
        }

        if (resp.status === 'in_progress') {
          const nextPollAt = new Date(
            Date.now() + 3000 + Math.floor(Math.random() * 4000),
          );
          chunk.status = 'SENT';
          chunk.nextPollAt = nextPollAt;
          await this.chunkRepo.save(chunk);
          continue;
        }

        // completed
        const itemsRaw: unknown = resp.result ?? [];
        const items: KeyTurboResultItem[] = Array.isArray(itemsRaw)
          ? itemsRaw.filter((x) => isKeyTurboResultItem(x))
          : [];

        chunk.status = 'COMPLETED';
        chunk.result = items;
        chunk.completedAt = new Date();
        chunk.nextPollAt = null;
        chunk.pollRetryCount = prevRetries;

        // пересчитаем количество завершённых чанков и, если все — завершим задачу
        await this.ds.transaction(async (trx) => {
          const cRepo = trx.getRepository(FrequencyChunk);
          const tRepo = trx.getRepository(FrequencyTask);

          await cRepo.save(chunk);

          const completedChunks = await cRepo.count({
            where: { taskId, status: 'COMPLETED' },
          });
          const totalChunks = await cRepo.count({
            where: { taskId },
          });

          const t = await tRepo.findOne({
            where: { id: taskId },
          });
          if (!t) return;

          t.chunksCompleted = completedChunks;

          if (completedChunks === totalChunks && totalChunks > 0) {
            t.status = 'COMPLETED';
            t.completedAt = new Date();
          }

          await tRepo.save(t);
        });
      }
    } catch (err) {
      const msg = this.extractErrMsg(err);
      this.log.error(`pollSent: fatal error: ${msg}`);
    }
  }

  // --- TTL: удаление старых задач ---

  /**
   * Раз в час удаляем:
   *  - задачи в статусе COMPLETED/ERROR, если completedAt старше 24 часов
   *  (на случай, если клиент не забрал результат);
   *  - их чанки.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldTasks(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const oldTasks = await this.taskRepo.find({
        where: {
          completedAt: LessThan(cutoff),
        },
      });

      const toDeleteIds = oldTasks.map((t) => t.id);

      if (toDeleteIds.length === 0) {
        return;
      }

      await this.ds.transaction(async (trx) => {
        await trx
          .getRepository(FrequencyChunk)
          .delete({ taskId: In(toDeleteIds) });
        await trx.getRepository(FrequencyTask).delete({ id: In(toDeleteIds) });
      });

      this.log.log(
        `cleanupOldTasks: deleted ${toDeleteIds.length} tasks older than 24h`,
      );
    } catch (err) {
      const msg = this.extractErrMsg(err);
      this.log.error(`cleanupOldTasks: fatal error: ${msg}`);
    }
  }
}
