import { toASCII } from 'punycode';
import dayjs from './dayjs';

/* ================================
 * Cyrillic → Latin
 * ================================ */

const cyrillicToLatinMap: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'YO',
  Ж: 'ZH',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'KH',
  Ц: 'TS',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SCH',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'YU',
  Я: 'YA',
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function cyrillicToLatin(str: string | null | undefined): string | null {
  if (!str) return null;

  return str
    .split('')
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join('')
    .replace(/[\s-]/g, '');
}

/* ================================
 * Site helpers
 * ================================ */

export function formatSiteAddress(
  str: string | null | undefined,
): string | null {
  if (!str) return null;
  return str.replace('.', '$');
}

/* ================================
 * Async helpers
 * ================================ */

export function timeout(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* ================================
 * Date helpers
 * ================================ */

export type DateFormatCheckResult = {
  isNewFormat: boolean;
  isOldFormat: boolean;
  isDate: boolean;
};

export const checkDateFormat = (date: string): DateFormatCheckResult => {
  const normalized = date.slice(-5) === '00-00' ? date.slice(0, 10) : date;

  const isNewFormat = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(normalized);
  const isOldFormat = /^\d{4}-\d{2}-\d{2}$/.test(normalized);

  return {
    isNewFormat,
    isOldFormat,
    isDate: isNewFormat || isOldFormat,
  };
};

export const getFormattedDate = (date: string): string => {
  const { isNewFormat, isDate } = checkDateFormat(date);
  if (!isDate) return date;

  const parsed = dayjs(date, isNewFormat ? 'YYYY-MM-DD-HH-mm' : 'YYYY-MM-DD');

  return isNewFormat ? parsed.format('DD.MM HH:mm') : parsed.format('DD.MM');
};

export const sortDates = (
  dates: string[],
  direction: 'asc' | 'desc' = 'asc',
): string[] => {
  return [...dates].sort((a, b) =>
    direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
  );
};

/* ================================
 * URL helpers
 * ================================ */

export function cleanRelativeUrlNoSlash(rawUrl: string): string {
  if (!rawUrl) return '/';

  let url = rawUrl.trim().split('#')[0].split('?')[0];

  try {
    const parsed = new URL(url);
    url = parsed.pathname;
  } catch {
    url = url.replace(/^(https?:\/\/)?[^/]+/, '');
  }

  if (!url) return '/';

  url = url.replace(/\/{2,}/g, '/').replace(/\/+$/, '');

  if (!url.startsWith('/')) url = '/' + url;

  return url || '/';
}

export type CleanRelativeUrlOptions = {
  preserveSearch?: boolean;
  preserveHash?: boolean;
};

export function cleanRelativeUrl(
  rawUrl: string,
  opts: CleanRelativeUrlOptions = {
    preserveSearch: true,
    preserveHash: true,
  },
): string {
  if (!rawUrl) return '/';

  let input = rawUrl.trim();

  let hash = '';
  const hashIdx = input.indexOf('#');
  if (hashIdx !== -1) {
    hash = input.slice(hashIdx);
    input = input.slice(0, hashIdx);
  }

  let search = '';
  const qIdx = input.indexOf('?');
  if (qIdx !== -1) {
    search = input.slice(qIdx);
    input = input.slice(0, qIdx);
  }

  let path = input;
  let hadTrailingSlash = /\/$/.test(input);

  try {
    const u = new URL(input);
    path = u.pathname;
    hadTrailingSlash = /\/$/.test(u.pathname);
    if (!search) search = u.search;
    if (!hash) hash = u.hash;
  } catch {
    path = path.replace(/^(?:[a-z]+:\/\/)?[^/]+/i, '');
  }

  if (!path) path = '/';

  path = path.replace(/\/{2,}/g, '/');

  if (!path.startsWith('/')) path = '/' + path;

  if (path === '/') {
    return (
      '/' +
      (opts.preserveSearch ? search : '') +
      (opts.preserveHash ? hash : '')
    );
  }

  path = hadTrailingSlash
    ? path.replace(/\/+$/, '') + '/'
    : path.replace(/\/+$/, '');

  if (opts.preserveSearch && search) path += search;
  if (opts.preserveHash && hash) path += hash;

  return path || '/';
}

/* ================================
 * Domain helpers
 * ================================ */

export function normalizePunycodeHostname(urlOrDomain: string): string {
  const cleaned = urlOrDomain.toLowerCase();
  try {
    return toASCII(cleaned);
  } catch {
    return cleaned;
  }
}

/* ================================
 * Masking helpers
 * ================================ */

export function maskLogin(value?: string | null): string {
  if (!value) return '***';

  const str = value.trim();
  if (!str) return '***';

  if (str.includes('@')) {
    const [local, domain] = str.split('@');

    if (!local || local.length < 3) {
      return `***@${domain || '***'}`;
    }

    const start = local.slice(0, 2);
    const end = local.slice(-2);

    return `${start}***${end}@${domain}`;
  }

  if (str.length <= 2) return '***';
  if (str.length <= 4) return `${str[0]}***`;

  const start = str.slice(0, 2);
  const end = str.slice(-2);

  return `${start}***${end}`;
}
