// src/modules/public-api/public-api-pause.service.ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

export type PublicApiPauseState = {
  paused: boolean;
  allowUserId: number | null;
  reason: string | null;
};

export const PAUSE_KEY = 'public_api:pause';

@Injectable()
export class PublicApiPauseService {
  private readonly log = new Logger(PublicApiPauseService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getState(): Promise<PublicApiPauseState> {
    const raw = await this.cache.get<PublicApiPauseState>(PAUSE_KEY);

    if (!raw || typeof raw !== 'object') {
      return { paused: false, allowUserId: null, reason: null };
    }

    return {
      paused: raw.paused === true,
      allowUserId: typeof raw.allowUserId === 'number' ? raw.allowUserId : null,
      reason: typeof raw.reason === 'string' ? raw.reason : null,
    };
  }

  async pause(params: {
    allowUserId: number;
    reason?: string;
    ttlSec?: number;
  }): Promise<void> {
    const payload: PublicApiPauseState = {
      paused: true,
      allowUserId: params.allowUserId,
      reason: params.reason ?? 'test_bench',
    };

    const ttlSec = params.ttlSec ?? 26 * 60;

    await this.cache.set(PAUSE_KEY, payload, ttlSec * 1000);

    this.log.warn(
      `Public API paused (allowUserId=${params.allowUserId}, ttl=${ttlSec}s)`,
    );
  }

  async resume(): Promise<void> {
    await this.cache.del(PAUSE_KEY);
    this.log.warn('Public API resumed');
  }
}
