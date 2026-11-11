// src/shared/money.ts
export function rubToThousandths(v: string | number): string {
  const s = String(v).trim().replace(',', '.');
  if (!s) return '0';
  const neg = s.startsWith('-');
  const u = s.replace(/^[-+]/, '');
  const [iRaw, fRaw = ''] = u.split('.');
  const i = BigInt(iRaw.match(/\d+/)?.[0] ?? '0');
  const f = BigInt(((fRaw.match(/\d+/)?.[0] ?? '') + '000').slice(0, 3));
  const n = i * 1000n + f;
  return (neg ? -n : n).toString();
}
export function thousandthsToRub(x: string): string {
  const n = BigInt(x || '0');
  const sign = n < 0n ? '-' : '';
  const a = n < 0n ? -n : n;
  const r = a / 1000n,
    f = a % 1000n;
  return `${sign}${r.toString()}.${f.toString().padStart(3, '0')}`;
}
export const add = (a: string, b: string) => (BigInt(a) + BigInt(b)).toString();
export const sub = (a: string, b: string) => (BigInt(a) - BigInt(b)).toString();
export const mulByInt = (a: string, k: number) =>
  (BigInt(a) * BigInt(k)).toString();
