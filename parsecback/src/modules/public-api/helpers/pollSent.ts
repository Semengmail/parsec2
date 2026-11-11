// src/modules/public-api/helpers/pollSent.ts
import { RSGetResp } from '../rankscan.client';

export type PickForSend = {
  cityName: string | null | undefined;
  id: number;
  userId: number;
  query: string;
  lr: number;
  device: 'desktop' | 'mobile';
  page: number;
  externalTaskId: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  uule: string | null;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function readNum(...v: unknown[]): number | null {
  for (const x of v) if (typeof x === 'number' && Number.isFinite(x)) return x;
  return null;
}
function readStr(...v: unknown[]): string | null {
  for (const x of v) if (typeof x === 'string' && x.length > 0) return x;
  return null;
}
function readDevice(...v: unknown[]): 'desktop' | 'mobile' | null {
  for (const x of v) if (x === 'desktop' || x === 'mobile') return x;
  return null;
}

export function toPickForSend(x: unknown): PickForSend | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;

  const id = readNum(o.id);
  const userId = readNum(o.userId, o.user_id);
  const query = readStr(o.query);
  const lr = readNum(o.lr);
  const device = readDevice(o.device);
  const page = Math.min(10, Math.max(0, readNum(o.page) ?? 0)) + 1;
  const externalTaskId = readNum(o.externalTaskId, o.external_task_id);
  const status = readStr(o.status) ?? '';
  const latitude = o.latitude == null ? null : Number(o.latitude);
  const longitude = o.longitude == null ? null : Number(o.longitude);
  const uule = readStr(o.uule);
  const cityName = readStr(o.cityName);

  if (
    id === null ||
    userId === null ||
    query === null ||
    lr === null ||
    device === null
  ) {
    return null;
  }
  return {
    id,
    userId,
    query,
    lr,
    device,
    page,
    externalTaskId,
    status,
    latitude,
    longitude,
    uule,
    cityName,
  };
}

/** Достаёт числовые id из «сырых» строк запроса, без any. */
export function extractIds(rows: unknown[]): number[] {
  return rows
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const v = (x as { id?: unknown }).id;
      return isFiniteNumber(v) ? v : null;
    })
    .filter((v): v is number => v !== null);
}

export type DSRaw =
  | { rows: unknown[]; rowCount?: number }
  | [unknown[], number]
  | unknown[]
  | null
  | undefined;

export function pickRows(raw: unknown): unknown[] {
  if (!raw) return [];
  // формат [rows, count]
  if (Array.isArray(raw)) {
    if (
      raw.length === 2 &&
      Array.isArray(raw[0]) &&
      typeof raw[1] === 'number'
    ) {
      return raw[0] as unknown[];
    }
    return raw as unknown[];
  }
  // формат { rows, rowCount }
  if (typeof raw === 'object' && 'rows' in (raw as Record<string, unknown>)) {
    const r = (raw as { rows: unknown }).rows;
    return Array.isArray(r) ? (r as unknown[]) : [];
  }
  return [];
}

export function isTransientError(err: unknown): boolean {
  const msg = (err as Error)?.message?.toLowerCase() ?? '';
  return (
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('ecconnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('rank-scan get 5') ||
    msg.includes('rank-scan create 5') ||
    msg.includes('bad gateway') ||
    msg.includes('service unavailable') ||
    msg.includes('gateway timeout') ||
    msg.includes('internal server error')
  );
}

export function calcNextDelayMs(retry: number): number {
  // экспоненциальный backoff: 5s,10s,20s,40s,60s (дальше — потолок 60s)
  const base = 5000;
  const max = 60000;
  const ms = base * Math.pow(2, Math.max(0, retry - 1));
  return Math.min(ms, max);
}

/* ───────────── guards & pickers (строгие) ───────────── */

function isPlainObject(u: unknown): u is Record<string, unknown> {
  return typeof u === 'object' && u !== null && !Array.isArray(u);
}
function isStringArray(u: unknown): u is string[] {
  return Array.isArray(u) && u.every((x) => typeof x === 'string');
}
function getProp(obj: unknown, key: string): unknown {
  if (!isPlainObject(obj)) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}
function pickString(u: unknown): string | null {
  return typeof u === 'string' && u.trim().length > 0 ? u : null;
}
function pickNumber(u: unknown): number | null {
  if (typeof u === 'number' && Number.isFinite(u)) return u;
  if (typeof u === 'string' && u.trim() !== '') {
    const n = Number(u);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Очищаем знаниевый объект до предсказуемых примитивов. */
function sanitizeKnowledgeGraph(
  input: unknown,
): Record<string, unknown> | null {
  if (!isPlainObject(input)) return null;

  const place_id = pickString(getProp(input, 'place_id'));
  const name = pickString(getProp(input, 'name'));
  const rating = pickNumber(getProp(input, 'rating'));
  const countReviews = pickNumber(getProp(input, 'countReviews'));
  const address = pickString(getProp(input, 'address'));
  const phone = pickString(getProp(input, 'phone'));

  const out: Record<string, unknown> = {};
  if (place_id) out.place_id = place_id;
  if (name) out.name = name;
  if (rating !== null) out.rating = rating;
  if (countReviews !== null) out.countReviews = countReviews;
  if (address) out.address = address;
  if (phone) out.phone = phone;

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Собирает page-level extras из top-level и pageMeta[0], строго и без any.
 * Возвращает {} если ничего полезного нет.
 */
export function extractPageExtras(resp: RSGetResp): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // — Top-level —
  const tlRelated = (resp as { relatedQuestions?: unknown }).relatedQuestions;
  if (isStringArray(tlRelated) && tlRelated.length > 0) {
    out.relatedQuestions = tlRelated;
  }
  const tlKG = (resp as { knowledgeGraph?: unknown }).knowledgeGraph;
  const tlKGSanitized = sanitizeKnowledgeGraph(tlKG);
  if (tlKGSanitized) out.knowledgeGraph = tlKGSanitized;

  // — pageMeta[0] —
  const pm = (resp as { pageMeta?: unknown }).pageMeta;
  if (Array.isArray(pm) && pm.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const first = pm[0];
    if (isPlainObject(first)) {
      const rq = getProp(first, 'relatedQuestions');
      if (isStringArray(rq) && rq.length > 0) {
        out.relatedQuestions = rq; // pageMeta перекрывает top-level, если есть
      }
      const kg = sanitizeKnowledgeGraph(getProp(first, 'knowledgeGraph'));
      if (kg) out.knowledgeGraph = kg; // аналогично
    }
  }

  return out;
}
