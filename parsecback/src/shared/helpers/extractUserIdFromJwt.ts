export function extractUserIdFromJwt(decoded: unknown): number {
  if (typeof decoded !== 'object' || decoded === null) return NaN;

  const rawSub = (decoded as Record<string, unknown>).sub;

  const id =
    typeof rawSub === 'number'
      ? rawSub
      : typeof rawSub === 'string'
        ? Number(rawSub)
        : NaN;

  return Number.isInteger(id) && id > 0 ? id : NaN;
}
