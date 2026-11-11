export function addStr(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}
export function subStr(a: string, b: string): string {
  return (BigInt(a) - BigInt(b)).toString();
}
export function mulStr(a: string, q: number): string {
  return (BigInt(a) * BigInt(q)).toString();
}
export function gteStr(a: string, b: string): boolean {
  return BigInt(a) >= BigInt(b);
}
export function absStr(a: string): string {
  const n = BigInt(a);
  return (n < 0n ? -n : n).toString();
}
