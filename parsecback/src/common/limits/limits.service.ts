import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  GlobalLimitsSettings,
  GlobalLimitsValue,
} from './entities/global-limits-settings.entity';

export type ServiceLimitKey =
  | 'yandexLive'
  | 'googleLive'
  | 'yandexXml'
  | 'frequency';

const SETTINGS_CACHE_KEY = 'global-limits-settings:v1';
const SETTINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LIMIT_VALUE = 10_000;

@Injectable()
export class LimitsService {
  constructor(
    private readonly cfg: ConfigService,
    @InjectRepository(GlobalLimitsSettings)
    private readonly repo: Repository<GlobalLimitsSettings>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  getDefaultSettings(): GlobalLimitsValue {
    return {
      globalMaxInFlight: this.readPositiveEnv('GLOBAL_MAX_IN_FLIGHT', 150),
      maxQueuedPerEngine: this.readPositiveEnv('MAX_QUEUED_PER_ENGINE', 200),
      services: {
        yandexLive: {
          userRequestLimit: this.readPositiveEnv(
            'YANDEX_LIVE_USER_REQUEST_LIMIT',
            15,
          ),
          adminRequestLimit: this.readPositiveEnv(
            'YANDEX_LIVE_REQUEST_LIMIT',
            80,
          ),
        },
        googleLive: {
          userRequestLimit: this.readPositiveEnv(
            'GOOGLE_LIVE_USER_REQUEST_LIMIT',
            15,
          ),
          adminRequestLimit: this.readPositiveEnv(
            'GOOGLE_LIVE_REQUEST_LIMIT',
            80,
          ),
        },
        yandexXml: {
          userRequestLimit: this.readPositiveEnv(
            'YANDEX_XML_REQUEST_LIMIT',
            30,
          ),
          adminRequestLimit: this.readPositiveEnv(
            'YANDEX_XML_ADMIN_REQUEST_LIMIT',
            80,
          ),
        },
        frequency: {
          userRequestLimit: this.readPositiveEnv('FREQUENCY_REQUEST_LIMIT', 25),
          adminRequestLimit: this.readPositiveEnv(
            'FREQUENCY_ADMIN_REQUEST_LIMIT',
            80,
          ),
        },
      },
    };
  }

  async getSettings(): Promise<GlobalLimitsValue> {
    const cached = await this.getCachedSettings();
    if (cached) return cached;

    const row = await this.repo.findOne({ where: {}, order: { id: 'DESC' } });
    const merged = this.normalizeSettings(row?.settings);
    await this.setCachedSettings(merged);
    return merged;
  }

  async updateSettings(input: GlobalLimitsValue): Promise<GlobalLimitsValue> {
    const settings = this.normalizeSettings(input);
    const latest = await this.repo.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    if (latest) {
      latest.settings = settings;
      await this.repo.save(latest);
    } else {
      await this.repo.save(this.repo.create({ settings }));
    }

    await this.clearSettingsCache();
    await this.setCachedSettings(settings);
    return settings;
  }

  async getGlobalMaxInFlight(): Promise<number> {
    return (await this.getSettings()).globalMaxInFlight;
  }

  async getYandexMaxInFlight(): Promise<number> {
    return (await this.getSettings()).services.yandexLive.adminRequestLimit;
  }

  async getGoogleMaxInFlight(): Promise<number> {
    return (await this.getSettings()).services.googleLive.adminRequestLimit;
  }

  async getMaxQueuedPerEngine(): Promise<number> {
    return (await this.getSettings()).maxQueuedPerEngine;
  }

  async getServiceRequestLimit(
    key: ServiceLimitKey,
    roles: string[] = [],
  ): Promise<number> {
    const service = (await this.getSettings()).services[key];
    return roles.includes('admin')
      ? service.adminRequestLimit
      : service.userRequestLimit;
  }

  getDeviceRatio() {
    return { desktop: 2, mobile: 3 };
  }

  private readPositiveEnv(name: string, fallback: number): number {
    const raw = Number(this.cfg.get(name, fallback));
    return Number.isInteger(raw) && raw > 0 ? raw : fallback;
  }

  private normalizeSettings(input: unknown): GlobalLimitsValue {
    const defaults = this.getDefaultSettings();
    const value = isRecord(input) ? input : {};
    const services = isRecord(value.services) ? value.services : {};

    return {
      globalMaxInFlight: this.normalizeInt(
        value.globalMaxInFlight,
        defaults.globalMaxInFlight,
        'globalMaxInFlight',
      ),
      maxQueuedPerEngine: this.normalizeInt(
        value.maxQueuedPerEngine,
        defaults.maxQueuedPerEngine,
        'maxQueuedPerEngine',
      ),
      services: {
        yandexLive: this.normalizeService(
          services.yandexLive,
          defaults.services.yandexLive,
          'yandexLive',
        ),
        googleLive: this.normalizeService(
          services.googleLive,
          defaults.services.googleLive,
          'googleLive',
        ),
        yandexXml: this.normalizeService(
          services.yandexXml,
          defaults.services.yandexXml,
          'yandexXml',
        ),
        frequency: this.normalizeService(
          services.frequency,
          defaults.services.frequency,
          'frequency',
        ),
      },
    };
  }

  private normalizeService(
    input: unknown,
    defaults: GlobalLimitsValue['services'][ServiceLimitKey],
    name: string,
  ): GlobalLimitsValue['services'][ServiceLimitKey] {
    const value = isRecord(input) ? input : {};
    return {
      userRequestLimit: this.normalizeInt(
        value.userRequestLimit,
        defaults.userRequestLimit,
        `${name}.userRequestLimit`,
      ),
      adminRequestLimit: this.normalizeInt(
        value.adminRequestLimit,
        defaults.adminRequestLimit,
        `${name}.adminRequestLimit`,
      ),
    };
  }

  private normalizeInt(raw: unknown, fallback: number, field: string): number {
    const n = Number(raw ?? fallback);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT_VALUE) {
      throw new BadRequestException(
        `${field} must be an integer from 1 to ${MAX_LIMIT_VALUE}`,
      );
    }
    return n;
  }

  private async getCachedSettings(): Promise<GlobalLimitsValue | null> {
    try {
      return (
        (await this.cache.get<GlobalLimitsValue>(SETTINGS_CACHE_KEY)) ?? null
      );
    } catch {
      return null;
    }
  }

  private async setCachedSettings(settings: GlobalLimitsValue): Promise<void> {
    try {
      await this.cache.set(SETTINGS_CACHE_KEY, settings, SETTINGS_CACHE_TTL_MS);
    } catch {
      // Cache is an optimization; DB/default settings remain authoritative.
    }
  }

  private async clearSettingsCache(): Promise<void> {
    try {
      await this.cache.del(SETTINGS_CACHE_KEY);
    } catch {
      // Non-fatal: the next set writes the fresh snapshot.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
