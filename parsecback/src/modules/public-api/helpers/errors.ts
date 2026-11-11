export function isTransientErrorString(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    s.includes('fetch failed') ||
    s.includes('timeout') ||
    s.includes('timed out') ||
    s.includes('ecconnreset') ||
    s.includes('econnrefused') ||
    s.includes('enotfound') ||
    s.includes('socket hang up') ||
    s.includes('network') ||
    s.includes('rank-scan get 5') ||
    s.includes('rank-scan create 5') ||
    s.includes('bad gateway') ||
    s.includes('service unavailable') ||
    s.includes('gateway timeout') ||
    s.includes('internal server error')
  );
}
