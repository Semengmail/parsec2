function normalizeBase(raw: string | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return 'http://localhost:7000';
  const withScheme = /^https?:\/\//i.test(v) ? v : `http://${v}`;
  return withScheme.replace(/\/+$/g, ''); // без хвостового слэша
}

// поддерживаем оба имени переменной, чтобы не ловить такие кейсы в будущем
const RAW =
  process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export const API_BASE = normalizeBase(RAW);
export const COOKIE_NAME = process.env.NEXT_PUBLIC_COOKIE_NAME ?? 'psk.sid';

export const MAIL = process.env.EMAIL_CONTACT ?? 'parsec@toolzar.ru';
export const PHONE = process.env.PHONE_CONTACT ?? '+79609969576';
