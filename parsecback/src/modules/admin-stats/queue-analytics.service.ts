import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { LimitsService } from '@/common/limits/limits.service';
import { TaskStatsService } from '../task-stats/task-stats.service';

type EngineKey = 'yandexlive' | 'googlelive';

type EngineQueueMetric = {
  queued: number;
  inFlight: number;
  sending: number;
  sent: number;
  polling: number;
  completedUnfetched: number;
  error: number;
  desktop: {
    queued: number;
    inFlight: number;
  };
  mobile: {
    queued: number;
    inFlight: number;
  };
};

type TotalQueueMetric = EngineQueueMetric & {
  capacity: number;
  available: number;
  saturationPct: number;
  overload: number;
  pressurePct: number;
};

type QueueThroughputMetric = {
  total: number;
  byEngine: Record<
    EngineKey,
    {
      total: number;
      desktop: number;
      mobile: number;
    }
  >;
};

export type QueueMinuteSample = {
  ts: string;
  total: TotalQueueMetric;
  byEngine: Record<EngineKey, EngineQueueMetric>;
  throughputPagesPerMinute: QueueThroughputMetric;
};

export type QueueHourBucket = {
  ts: string;
  samples: number;
  queuedAvg: number;
  queuedMax: number;
  inFlightAvg: number;
  inFlightMax: number;
  saturationAvg: number;
  saturationMax: number;
  overloadAvg: number;
  overloadMax: number;
  yandexQueuedMax: number;
  googleQueuedMax: number;
  throughputPagesAvg: number;
  throughputPagesMax: number;
  yandexThroughputPagesMax: number;
  googleThroughputPagesMax: number;
  yandexDesktopThroughputPagesMax: number;
  yandexMobileThroughputPagesMax: number;
  googleDesktopThroughputPagesMax: number;
  googleMobileThroughputPagesMax: number;
};

export type QueueDayBucket = {
  date: string;
  weekday: string;
  samples: number;
  queuedAvg: number;
  queuedMax: number;
  inFlightAvg: number;
  inFlightMax: number;
  saturationMax: number;
  overloadMax: number;
  throughputPagesAvg: number;
  throughputPagesMax: number;
};

export type QueueAnalyticsResponse = {
  current: QueueMinuteSample | null;
  realtime: QueueMinuteSample[];
  hourly: QueueHourBucket[];
  daily: QueueDayBucket[];
  summary: {
    state: 'idle' | 'normal' | 'busy' | 'overloaded';
    message: string;
    overloadMinutesLastHour: number;
    scaleSignal: boolean;
    devicePressure: 'desktop' | 'mobile' | 'balanced' | null;
    peakHour: QueueHourBucket | null;
    worstEngine: EngineKey | 'balanced' | null;
  };
};

const REALTIME_KEY = 'queue-analytics:realtime:v2';
const HOURLY_KEY = 'queue-analytics:hourly:v2';
const DAILY_KEY = 'queue-analytics:daily:v2';
const CURRENT_KEY = 'queue-analytics:current:v2';
const REALTIME_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_REALTIME_SAMPLES = 60;
const MAX_HOURLY_BUCKETS = 48;
const MAX_DAILY_BUCKETS = 28;

@Injectable()
export class QueueAnalyticsService {
  private readonly log = new Logger(QueueAnalyticsService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly limits: LimitsService,
    private readonly taskStats: TaskStatsService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectSafe(): Promise<void> {
    try {
      await this.collect({ drainThroughput: true, persist: true });
    } catch (e) {
      this.log.warn(
        `Queue analytics collection failed: ${(e as Error).message}`,
      );
    }
  }

  async getAnalytics(): Promise<QueueAnalyticsResponse> {
    let current: QueueMinuteSample | null = null;
    try {
      current = await this.collect({ drainThroughput: false, persist: false });
    } catch (e) {
      this.log.warn(
        `Queue analytics request collect failed: ${(e as Error).message}`,
      );
      current = await this.getCache<QueueMinuteSample>(CURRENT_KEY);
    }

    const [realtime, hourly, daily] = await Promise.all([
      this.getCache<QueueMinuteSample[]>(REALTIME_KEY),
      this.getCache<QueueHourBucket[]>(HOURLY_KEY),
      this.getCache<QueueDayBucket[]>(DAILY_KEY),
    ]);

    const realtimeRows = realtime ?? [];
    const hourlyRows = hourly ?? [];

    return {
      current,
      realtime: realtimeRows,
      hourly: hourlyRows,
      daily: daily ?? [],
      summary: this.buildSummary(current, realtimeRows, hourlyRows),
    };
  }

  private async collect(options: {
    drainThroughput: boolean;
    persist: boolean;
  }): Promise<QueueMinuteSample> {
    const now = new Date();
    const [yandex, google, capacity, throughputPagesPerMinute] =
      await Promise.all([
        this.getEngineMetric('public_yandexlive_tasks'),
        this.getEngineMetric('public_googlelive_tasks'),
        this.limits.getGlobalMaxInFlight(),
        options.drainThroughput
          ? this.drainThroughputPagesPerMinute()
          : this.getLastThroughputPagesPerMinute(),
      ]);

    const inFlight = yandex.inFlight + google.inFlight;
    const queued = yandex.queued + google.queued;
    const available = Math.max(0, capacity - inFlight);
    const overload = Math.max(0, queued - available);

    const sample: QueueMinuteSample = {
      ts: now.toISOString(),
      total: {
        queued,
        inFlight,
        sending: yandex.sending + google.sending,
        sent: yandex.sent + google.sent,
        polling: yandex.polling + google.polling,
        completedUnfetched:
          yandex.completedUnfetched + google.completedUnfetched,
        error: yandex.error + google.error,
        desktop: {
          queued: yandex.desktop.queued + google.desktop.queued,
          inFlight: yandex.desktop.inFlight + google.desktop.inFlight,
        },
        mobile: {
          queued: yandex.mobile.queued + google.mobile.queued,
          inFlight: yandex.mobile.inFlight + google.mobile.inFlight,
        },
        capacity,
        available,
        saturationPct:
          capacity > 0 ? Math.round((inFlight / capacity) * 100) : 0,
        overload,
        pressurePct:
          capacity > 0 ? Math.round(((inFlight + queued) / capacity) * 100) : 0,
      },
      byEngine: {
        yandexlive: yandex,
        googlelive: google,
      },
      throughputPagesPerMinute,
    };

    if (options.persist) {
      await Promise.all([
        this.setCache(CURRENT_KEY, sample, REALTIME_TTL_MS),
        this.appendRealtime(sample),
        this.upsertHour(sample),
        this.upsertDay(sample),
      ]);
    }

    return sample;
  }

  private async getLastThroughputPagesPerMinute(): Promise<QueueThroughputMetric> {
    const current = await this.getCache<QueueMinuteSample>(CURRENT_KEY);
    return current?.throughputPagesPerMinute ?? emptyThroughputMetric();
  }

  private async drainThroughputPagesPerMinute(): Promise<QueueThroughputMetric> {
    return this.taskStats.getPreviousMinuteThroughput();
  }

  private async getEngineMetric(table: string): Promise<EngineQueueMetric> {
    const rows: { status: string; device: string | null; count: number }[] =
      await this.ds.query(`
      SELECT status, device, COUNT(*)::int AS count
      FROM ${table}
      GROUP BY status, device
    `);

    const statusCount = (status: string): number =>
      rows
        .filter((row) => row.status === status)
        .reduce((sum, row) => sum + row.count, 0);
    const deviceStatusCount = (device: string, statuses: string[]): number =>
      rows
        .filter((row) => row.device === device && statuses.includes(row.status))
        .reduce((sum, row) => sum + row.count, 0);

    const sending = statusCount('SENDING');
    const sent = statusCount('SENT');
    const polling = statusCount('POLLING');

    return {
      queued: statusCount('QUEUED'),
      sending,
      sent,
      polling,
      completedUnfetched: statusCount('COMPLETED'),
      error: statusCount('ERROR'),
      inFlight: sending + sent + polling,
      desktop: {
        queued: deviceStatusCount('desktop', ['QUEUED']),
        inFlight: deviceStatusCount('desktop', ['SENDING', 'SENT', 'POLLING']),
      },
      mobile: {
        queued: deviceStatusCount('mobile', ['QUEUED']),
        inFlight: deviceStatusCount('mobile', ['SENDING', 'SENT', 'POLLING']),
      },
    };
  }

  private async appendRealtime(sample: QueueMinuteSample): Promise<void> {
    const rows = (await this.getCache<QueueMinuteSample[]>(REALTIME_KEY)) ?? [];
    rows.push(sample);
    await this.setCache(
      REALTIME_KEY,
      rows.slice(-MAX_REALTIME_SAMPLES),
      REALTIME_TTL_MS,
    );
  }

  private async upsertHour(sample: QueueMinuteSample): Promise<void> {
    const rows = (await this.getCache<QueueHourBucket[]>(HOURLY_KEY)) ?? [];
    const ts = startOfHour(sample.ts);
    const idx = rows.findIndex((row) => row.ts === ts);
    const current = idx >= 0 ? rows[idx] : emptyHourBucket(ts);
    const next = mergeHour(current, sample);

    if (idx >= 0) rows[idx] = next;
    else rows.push(next);

    await this.setCache(
      HOURLY_KEY,
      rows.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-MAX_HOURLY_BUCKETS),
      HISTORY_TTL_MS,
    );
  }

  private async upsertDay(sample: QueueMinuteSample): Promise<void> {
    const rows = (await this.getCache<QueueDayBucket[]>(DAILY_KEY)) ?? [];
    const date = sample.ts.slice(0, 10);
    const idx = rows.findIndex((row) => row.date === date);
    const current = idx >= 0 ? rows[idx] : emptyDayBucket(date);
    const next = mergeDay(current, sample);

    if (idx >= 0) rows[idx] = next;
    else rows.push(next);

    await this.setCache(
      DAILY_KEY,
      rows
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-MAX_DAILY_BUCKETS),
      HISTORY_TTL_MS,
    );
  }

  private buildSummary(
    current: QueueMinuteSample | null,
    realtime: QueueMinuteSample[],
    hourly: QueueHourBucket[],
  ): QueueAnalyticsResponse['summary'] {
    const overloadMinutesLastHour = realtime.filter(
      (row) => row.total.overload > 0,
    ).length;
    const busyMinutesLastHour = realtime.filter(
      (row) => row.total.saturationPct >= 80 || row.total.queued > 0,
    ).length;
    const peakHour =
      hourly.length > 0
        ? [...hourly].sort((a, b) => b.overloadMax - a.overloadMax)[0]
        : null;

    const yandexQueued = current?.byEngine.yandexlive.queued ?? 0;
    const googleQueued = current?.byEngine.googlelive.queued ?? 0;
    const desktopPressure =
      (current?.total.desktop.queued ?? 0) +
      (current?.total.desktop.inFlight ?? 0);
    const mobilePressure =
      (current?.total.mobile.queued ?? 0) +
      (current?.total.mobile.inFlight ?? 0);
    const devicePressure =
      desktopPressure === mobilePressure
        ? desktopPressure > 0
          ? 'balanced'
          : null
        : desktopPressure > mobilePressure
          ? 'desktop'
          : 'mobile';
    const worstEngine =
      yandexQueued === googleQueued
        ? yandexQueued > 0
          ? 'balanced'
          : null
        : yandexQueued > googleQueued
          ? 'yandexlive'
          : 'googlelive';

    const saturation = current?.total.saturationPct ?? 0;
    const overload = current?.total.overload ?? 0;
    const queued = current?.total.queued ?? 0;
    const scaleSignal =
      overloadMinutesLastHour >= 5 ||
      busyMinutesLastHour >= 30 ||
      (peakHour?.overloadMax ?? 0) > 0;

    if (!current || (queued === 0 && saturation < 30)) {
      return {
        state: 'idle',
        message: 'Очередь спокойная, запас мощности высокий.',
        overloadMinutesLastHour,
        scaleSignal,
        devicePressure,
        peakHour,
        worstEngine,
      };
    }

    if (overload > 0 || overloadMinutesLastHour >= 10) {
      return {
        state: 'overloaded',
        message: 'Есть перегруз: очередь выше свободной мощности.',
        overloadMinutesLastHour,
        scaleSignal,
        devicePressure,
        peakHour,
        worstEngine,
      };
    }

    if (saturation >= 80 || queued > 0) {
      return {
        state: 'busy',
        message: 'Нагрузка высокая, стоит следить за ближайшими часами.',
        overloadMinutesLastHour,
        scaleSignal,
        devicePressure,
        peakHour,
        worstEngine,
      };
    }

    return {
      state: 'normal',
      message: 'Нагрузка в норме, очередь не давит на мощность.',
      overloadMinutesLastHour,
      scaleSignal,
      devicePressure,
      peakHour,
      worstEngine,
    };
  }

  private async getCache<T>(key: string): Promise<T | null> {
    try {
      return (await this.cache.get<T>(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async setCache<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
    } catch {
      // Analytics cache failures must never affect parsing.
    }
  }
}

function emptyHourBucket(ts: string): QueueHourBucket {
  return {
    ts,
    samples: 0,
    queuedAvg: 0,
    queuedMax: 0,
    inFlightAvg: 0,
    inFlightMax: 0,
    saturationAvg: 0,
    saturationMax: 0,
    overloadAvg: 0,
    overloadMax: 0,
    yandexQueuedMax: 0,
    googleQueuedMax: 0,
    throughputPagesAvg: 0,
    throughputPagesMax: 0,
    yandexThroughputPagesMax: 0,
    googleThroughputPagesMax: 0,
    yandexDesktopThroughputPagesMax: 0,
    yandexMobileThroughputPagesMax: 0,
    googleDesktopThroughputPagesMax: 0,
    googleMobileThroughputPagesMax: 0,
  };
}

function emptyDayBucket(date: string): QueueDayBucket {
  return {
    date,
    weekday: new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(
      new Date(`${date}T00:00:00.000Z`),
    ),
    samples: 0,
    queuedAvg: 0,
    queuedMax: 0,
    inFlightAvg: 0,
    inFlightMax: 0,
    saturationMax: 0,
    overloadMax: 0,
    throughputPagesAvg: 0,
    throughputPagesMax: 0,
  };
}

function emptyThroughputMetric(): QueueThroughputMetric {
  return {
    total: 0,
    byEngine: {
      yandexlive: { total: 0, desktop: 0, mobile: 0 },
      googlelive: { total: 0, desktop: 0, mobile: 0 },
    },
  };
}

function mergeHour(
  bucket: QueueHourBucket,
  sample: QueueMinuteSample,
): QueueHourBucket {
  const samples = bucket.samples + 1;
  return {
    ...bucket,
    samples,
    queuedAvg: rollingAvg(
      bucket.queuedAvg,
      bucket.samples,
      sample.total.queued,
    ),
    queuedMax: Math.max(bucket.queuedMax, sample.total.queued),
    inFlightAvg: rollingAvg(
      bucket.inFlightAvg,
      bucket.samples,
      sample.total.inFlight,
    ),
    inFlightMax: Math.max(bucket.inFlightMax, sample.total.inFlight),
    saturationAvg: rollingAvg(
      bucket.saturationAvg,
      bucket.samples,
      sample.total.saturationPct,
    ),
    saturationMax: Math.max(bucket.saturationMax, sample.total.saturationPct),
    overloadAvg: rollingAvg(
      bucket.overloadAvg,
      bucket.samples,
      sample.total.overload,
    ),
    overloadMax: Math.max(bucket.overloadMax, sample.total.overload),
    yandexQueuedMax: Math.max(
      bucket.yandexQueuedMax,
      sample.byEngine.yandexlive.queued,
    ),
    googleQueuedMax: Math.max(
      bucket.googleQueuedMax,
      sample.byEngine.googlelive.queued,
    ),
    throughputPagesAvg: rollingAvg(
      bucket.throughputPagesAvg ?? 0,
      bucket.samples,
      sample.throughputPagesPerMinute.total,
    ),
    throughputPagesMax: Math.max(
      bucket.throughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.total,
    ),
    yandexThroughputPagesMax: Math.max(
      bucket.yandexThroughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.byEngine.yandexlive.total,
    ),
    googleThroughputPagesMax: Math.max(
      bucket.googleThroughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.byEngine.googlelive.total,
    ),
    yandexDesktopThroughputPagesMax: Math.max(
      bucket.yandexDesktopThroughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.byEngine.yandexlive.desktop,
    ),
    yandexMobileThroughputPagesMax: Math.max(
      bucket.yandexMobileThroughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.byEngine.yandexlive.mobile,
    ),
    googleDesktopThroughputPagesMax: Math.max(
      bucket.googleDesktopThroughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.byEngine.googlelive.desktop,
    ),
    googleMobileThroughputPagesMax: Math.max(
      bucket.googleMobileThroughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.byEngine.googlelive.mobile,
    ),
  };
}

function mergeDay(
  bucket: QueueDayBucket,
  sample: QueueMinuteSample,
): QueueDayBucket {
  return {
    ...bucket,
    samples: bucket.samples + 1,
    queuedAvg: rollingAvg(
      bucket.queuedAvg,
      bucket.samples,
      sample.total.queued,
    ),
    queuedMax: Math.max(bucket.queuedMax, sample.total.queued),
    inFlightAvg: rollingAvg(
      bucket.inFlightAvg,
      bucket.samples,
      sample.total.inFlight,
    ),
    inFlightMax: Math.max(bucket.inFlightMax, sample.total.inFlight),
    saturationMax: Math.max(bucket.saturationMax, sample.total.saturationPct),
    overloadMax: Math.max(bucket.overloadMax, sample.total.overload),
    throughputPagesAvg: rollingAvg(
      bucket.throughputPagesAvg ?? 0,
      bucket.samples,
      sample.throughputPagesPerMinute.total,
    ),
    throughputPagesMax: Math.max(
      bucket.throughputPagesMax ?? 0,
      sample.throughputPagesPerMinute.total,
    ),
  };
}

function rollingAvg(
  currentAvg: number,
  currentCount: number,
  next: number,
): number {
  return (
    Math.round(((currentAvg * currentCount + next) / (currentCount + 1)) * 10) /
    10
  );
}

function startOfHour(input: string): string {
  const date = new Date(input);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}
