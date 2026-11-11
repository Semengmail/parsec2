export function formatMetricDate(iso: string): string {
  return iso.replace('T', ' ').substring(0, 16);
}
