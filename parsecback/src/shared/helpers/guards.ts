import { RSSitelink } from '@/modules/public-api/rankscan.client';

export function toTrimmedLower(x: unknown): string | undefined {
  if (typeof x !== 'string') return undefined;
  const s = x.trim().toLowerCase();
  return s.length ? s : undefined;
}
export function toFiniteNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === 'bigint') return Number(x);
  if (typeof x === 'boolean') return x ? 1 : 0;
  return null;
}

export function toSafeString(x: unknown): string | null {
  if (typeof x === 'string') return x;
  if (
    typeof x === 'number' ||
    typeof x === 'boolean' ||
    typeof x === 'bigint'
  ) {
    return String(x);
  }
  return null;
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export const toStringOrNull = (v: unknown): string | null =>
  typeof v === 'string' ? v : null;

export const toBooleanOrNull = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;

export const toStringArrayOrNull = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;

export const mapSitelinksOrNull = (v: unknown): RSSitelink[] | null => {
  if (!Array.isArray(v)) return null;
  const out: RSSitelink[] = [];
  for (const s of v) {
    if (!isRecord(s)) continue;
    const url = toSafeString(s.url);
    if (!url) continue;
    const title = typeof s.title === 'string' ? s.title : undefined;
    const snippet = typeof s.snippet === 'string' ? s.snippet : undefined;
    out.push({ url, title, snippet });
  }
  return out.length ? out : [];
};

// shared/helpers/guards.ts
export function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
export function getProp(
  obj: Record<string, unknown> | null,
  key: string,
): unknown {
  return obj && Object.prototype.hasOwnProperty.call(obj, key)
    ? obj[key]
    : undefined;
}
