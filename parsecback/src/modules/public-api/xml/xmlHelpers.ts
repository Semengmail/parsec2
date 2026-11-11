export function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === 'object' && u !== null && !Array.isArray(u);
}
export function getStr(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  return typeof v === 'string' && v.trim().length ? v : null;
}
export function getNum(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function renderSitelinks(
  tag: 'sitelinks' | 'oneline_sitelinks',
  arr?: Array<{
    title?: string | null;
    url?: string | null;
    snippet?: string | null;
  }> | null,
): string {
  if (!Array.isArray(arr) || !arr.length) return '';
  const xml = arr
    .map((s) => {
      const u = typeof s?.url === 'string' ? s.url : '';
      const t = typeof s?.title === 'string' ? s.title : '';
      const sn = typeof s?.snippet === 'string' ? s.snippet : '';
      return `<sitelink>${u ? `<url>${escapeXml(u)}</url>` : '<url/>'}${t ? `<title>${escapeXml(t)}</title>` : '<title/>'}${sn ? `<snippet>${escapeXml(sn)}</snippet>` : '<snippet/>'}</sitelink>`;
    })
    .join('');
  return `<${tag}>${xml}</${tag}>`;
}

export function formatYxmlDate(d: Date): string {
  // YYYYMMDDTHHMMSS
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    d.getUTCFullYear().toString() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    'T' +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds())
  );
}

export function escapeXmlOld(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Паттерн записан как обычная строка — ЛИНТЕР НЕ ВИДИТ тут control chars.
const INVALID_XML_CHARS_PATTERN =
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]';

const INVALID_XML_CHARS_REGEX = new RegExp(INVALID_XML_CHARS_PATTERN, 'g');

export function escapeXml(input: string): string {
  if (typeof input !== 'string') return '';

  // 1. Удаляем недопустимые XML control chars
  const cleaned = input.replace(INVALID_XML_CHARS_REGEX, '');

  // 2. Экранируем спецсимволы XML
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function extractDomainSafe(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function simpleHexHash(s: string): string {
  let h = 0 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i)) >>> 0;
    h = (h + (h << 10)) >>> 0;
    h ^= h >>> 6;
  }
  h = (h + (h << 3)) >>> 0;
  h ^= h >>> 11;
  h = (h + (h << 15)) >>> 0;
  return h.toString(16).padStart(8, '0').toUpperCase();
}

export function genReqId(): string {
  const t = Math.floor(Date.now() / 1000);
  const rand = Math.floor(Math.random() * 1e9);
  return `${t}-${rand.toString().padStart(9, '0')}-balancer-sim`;
}

export function formatFoundHuman(n: number): string {
  if (n >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10;
    return `${m.toString().replace('.', ',')} млн.`;
  }
  if (n >= 1000) {
    const k = Math.round((n / 1000) * 10) / 10;
    return `${k.toString().replace('.', ',')} тыс.`;
  }
  return `${n}`;
}
