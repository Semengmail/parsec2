import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LimitsService } from '@/common/limits/limits.service';

export interface EngineStats {
  queued: number;
  sending: number;
  sent: number;
  polling: number;
  completedUnfetched: number;
  error: number;
  inflight: number;
}

export interface GlobalStats {
  total: EngineStats;
  byEngine: {
    yandexlive: EngineStats;
    googlelive: EngineStats;
  };
  limits: {
    globalMax: number;
    yandexliveCap: number;
    googleliveCap: number;
    currentInFlightTotal: number;
    available: number;
  };
}

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly ds: DataSource,
    private readonly limits: LimitsService,
  ) {}

  async getQueueStats(): Promise<GlobalStats> {
    const [yandex, google] = await Promise.all([
      this.getEngineStats('public_yandexlive_tasks'),
      this.getEngineStats('public_googlelive_tasks'),
    ]);

    const total = this.mergeTotals(yandex, google);
    const currentInFlightTotal = yandex.inflight + google.inflight;

    const [globalMax, yandexliveCap, googleliveCap] = await Promise.all([
      this.limits.getGlobalMaxInFlight(),
      this.limits.getYandexMaxInFlight(),
      this.limits.getGoogleMaxInFlight(),
    ]);

    return {
      total,
      byEngine: { yandexlive: yandex, googlelive: google },
      limits: {
        globalMax,
        yandexliveCap,
        googleliveCap,
        currentInFlightTotal,
        available: Math.max(0, globalMax - currentInFlightTotal),
      },
    };
  }

  private async getEngineStats(table: string): Promise<EngineStats> {
    const sql = `
      SELECT status, COUNT(*)::int AS count
      FROM ${table}
      GROUP BY status;
    `;
    const rows: { status: string; count: number }[] = await this.ds.query(sql);

    // создаём словарь без any
    const map = new Map<string, number>(rows.map((r) => [r.status, r.count]));

    const queued = map.get('QUEUED') ?? 0;
    const sending = map.get('SENDING') ?? 0;
    const sent = map.get('SENT') ?? 0;
    const polling = map.get('POLLING') ?? 0;
    const completedUnfetched = map.get('COMPLETED') ?? 0;
    const error = map.get('ERROR') ?? 0;

    return {
      queued,
      sending,
      sent,
      polling,
      completedUnfetched,
      error,
      inflight: sending + sent + polling,
    };
  }

  private mergeTotals(y: EngineStats, g: EngineStats): EngineStats {
    return {
      queued: y.queued + g.queued,
      sending: y.sending + g.sending,
      sent: y.sent + g.sent,
      polling: y.polling + g.polling,
      completedUnfetched: y.completedUnfetched + g.completedUnfetched,
      error: y.error + g.error,
      inflight: y.inflight + g.inflight,
    };
  }
}
