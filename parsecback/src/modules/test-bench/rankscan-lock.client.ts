import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RankScanLockState {
  yandex: boolean;
  google: boolean;
}

export type CaptchaMetricsEngine = 'yandex' | 'google';
export type CaptchaMetricsDevice = 'desktop' | 'mobile';

export interface CaptchaMetricsDeviceStats {
  zeroCaptchaCount: number;
  values: number[];
  avg: number;
}

export interface CaptchaMetricsEngineStats {
  yandex?: Partial<Record<CaptchaMetricsDevice, CaptchaMetricsDeviceStats>>;
  google?: Partial<Record<CaptchaMetricsDevice, CaptchaMetricsDeviceStats>>;
}

export type CaptchaMetricsResponse = Record<string, CaptchaMetricsEngineStats>;

@Injectable()
export class RankScanLockClient {
  private readonly base: string;
  private readonly log = new Logger(RankScanLockClient.name);

  constructor(cfg: ConfigService) {
    this.base = cfg.get<string>('RANKSCAN_BASE_URL') ?? 'http://127.0.0.1:3003';
  }

  async getStatus(): Promise<RankScanLockState | null> {
    try {
      const res = await fetch(`${this.base}/api/parser-lock`);
      if (!res.ok) {
        this.log.warn(`RankScan GET failed: ${res.status} ${res.statusText}`);
        return null;
      }

      const data = (await res.json()) as unknown;

      if (
        typeof data === 'object' &&
        data !== null &&
        'yandex' in data &&
        'google' in data
      ) {
        return data as RankScanLockState;
      }

      this.log.warn('RankScan GET: malformed response');
      return null;
    } catch (err) {
      this.log.warn(`RankScan GET error: ${(err as Error).message}`);
      return null;
    }
  }

  async setStatus(update: Partial<RankScanLockState>): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/api/parser-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      if (!res.ok) {
        this.log.warn(`RankScan POST failed: ${res.status} ${res.statusText}`);
        return false;
      }

      return true;
    } catch (err) {
      this.log.warn(`RankScan POST error: ${(err as Error).message}`);
      return false;
    }
  }

  async getMetrics(): Promise<CaptchaMetricsResponse | null> {
    try {
      const res = await fetch(`${this.base}/api/captcha-metrics`);
      if (!res.ok) {
        this.log.warn(`RankScan GET captcha failed: ${res.status}`);
        return null;
      }
      const json = (await res.json()) as unknown;

      if (json && typeof json === 'object') {
        return json as CaptchaMetricsResponse;
      }

      this.log.warn('Malformed captcha metrics response');
      return null;
    } catch (e) {
      this.log.warn(`Captcha GET error: ${(e as Error).message}`);
      return null;
    }
  }

  async clearMetrics(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/api/captcha-metrics`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        this.log.warn(`RankScan DELETE failed: ${res.status}`);
        return false;
      }

      return true;
    } catch (e) {
      this.log.warn(`Captcha DELETE error: ${(e as Error).message}`);
      return false;
    }
  }
}
