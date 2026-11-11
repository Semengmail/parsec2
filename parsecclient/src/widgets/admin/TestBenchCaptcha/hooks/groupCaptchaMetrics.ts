import { TestBenchCaptchaMetric } from '@/features/test-bench/api';
import { CaptchaGrouped } from '../types/captchaTypes';
import { formatMetricDate } from '../utils/formatDate';

export function groupCaptchaMetrics(
  rows: TestBenchCaptchaMetric[]
): CaptchaGrouped {
  const servers: CaptchaGrouped['servers'] = {};
  const allDatesSet = new Set<string>();

  for (const r of rows) {
    const date = formatMetricDate(r.collectedAt);
    allDatesSet.add(date);

    if (!servers[r.serverId]) {
      servers[r.serverId] = {
        yandex: { desktop: [], mobile: [] },
        google: { desktop: [], mobile: [] },
      };
    }
    servers[r.serverId][r.engine][r.device].push(r);
  }

  return {
    servers,
    allDates: Array.from(allDatesSet).sort((a, b) => (a < b ? 1 : -1)),
  };
}
