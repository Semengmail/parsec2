import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

import { UsersService } from '@/modules/users/users.service';
import { TariffsService } from '@/modules/tariffs/tariffs.service';
import { Tariff } from '@/modules/tariffs/entities/tariff.entity';
import { UserTariff } from '@/modules/tariffs/entities/user-tariff.entity';
import { SERVICES } from './services.registry';
import { User } from '../users/entities/user.entity';
import { LimitsService, ServiceLimitKey } from '@/common/limits/limits.service';

type UrlSectionKey =
  | 'yandex'
  | 'yandexlive'
  | 'google'
  | 'webmaster'
  | 'wordstat'
  | 'frequency';

type MoneyStr = string;
type ServiceSlugKey = keyof typeof SERVICES;

interface UrlMethodBlock {
  xml: string; // основной вызов
  status?: string; // async статус
}

interface UrlSection {
  method: UrlMethodBlock;
  price: MoneyStr;
  query_today: string;
  query_today_limit: string;
  request_limit: string;
}

// сервисы, которые отдаём наружу
const EXPOSED = [
  'yandex-xml',
  'yandex-live',
  'google-live',
  'frequency',
] as const;

// сервисы, которые работают в режиме async
const ASYNC = new Set<ServiceSlugKey>([
  'yandex-live',
  'google-live',
  'frequency',
]);

// сервисы, которые вызываются через POST
const POST_ONLY = new Set<ServiceSlugKey>(['frequency']);
const MIRROR_HOSTS = new Set(['api.parsec.toolzar.su']);
const DEFAULT_MIRROR_URL = 'https://api.parsec.toolzar.su';
const DEFAULT_MIRROR_IPS = ['194.156.103.115'];
const MIRROR_HOST_HEADERS = ['x-mirror-host', 'x-original-host'] as const;

@Injectable()
export class PublicInfoService {
  constructor(
    private readonly cfg: ConfigService,
    private readonly users: UsersService,
    private readonly tariffs: TariffsService,
    private readonly ds: DataSource,
    private readonly limits: LimitsService,
  ) {}

  private getHeaderValue(
    header: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(header)) {
      return header[0];
    }
    return header;
  }

  private firstForwardedValue(value: string | undefined): string | undefined {
    return value?.split(',')[0]?.trim() || undefined;
  }

  private csvValues(value: string | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeIp(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.replace(/^::ffff:/i, '');
  }

  private isMirrorRequestByIp(req: Request): boolean {
    const configuredIps = this.csvValues(
      this.cfg.get<string>('PUBLIC_MIRROR_IPS'),
    );
    const mirrorIps = new Set(
      (configuredIps.length ? configuredIps : DEFAULT_MIRROR_IPS).map((ip) =>
        this.normalizeIp(ip),
      ),
    );

    const forwardedFor = this.getHeaderValue(req.headers['x-forwarded-for']);
    const candidates = [
      req.socket.remoteAddress,
      req.ip,
      ...this.csvValues(forwardedFor),
    ]
      .map((item) => this.normalizeIp(item))
      .filter((item): item is string => Boolean(item));

    return candidates.some((ip) => mirrorIps.has(ip));
  }

  private baseUrl(req?: Request): string {
    const fallback = this.cfg.get<string>(
      'PUBLIC_URL',
      'http://localhost:3000',
    );
    const base = new URL(fallback);
    const mirrorBase = new URL(
      this.cfg.get<string>('PUBLIC_MIRROR_URL', DEFAULT_MIRROR_URL),
    );

    if (!req) {
      return base.toString();
    }

    const mirrorHeaderHost = MIRROR_HOST_HEADERS.map((header) =>
      this.firstForwardedValue(this.getHeaderValue(req.headers[header])),
    ).find(Boolean);
    const forwardedHost = this.firstForwardedValue(
      this.getHeaderValue(req.headers['x-forwarded-host']),
    );
    const resolvedHost = (
      mirrorHeaderHost ??
      forwardedHost ??
      req.get('host') ??
      undefined
    )?.trim();
    const hostname = resolvedHost?.split(':')[0]?.toLowerCase();

    const forwardedProto = this.firstForwardedValue(
      this.getHeaderValue(req.headers['x-forwarded-proto']),
    );
    const protocol = (
      forwardedProto ??
      req.protocol ??
      base.protocol.replace(/:$/, '')
    )
      .toLowerCase()
      .replace(/:$/, '');

    if (resolvedHost && hostname && MIRROR_HOSTS.has(hostname)) {
      mirrorBase.protocol = `${protocol}:`;
      mirrorBase.host = resolvedHost;
      return mirrorBase.toString();
    }

    if (this.isMirrorRequestByIp(req)) {
      return mirrorBase.toString();
    }

    return base.toString();
  }

  private requestLimitKeyFor(code: string): ServiceLimitKey | null {
    switch (code) {
      case 'YANDEX_XML_TOP100':
        return 'yandexXml';
      case 'YANDEX_LIVE':
        return 'yandexLive';
      case 'GOOGLE_LIVE':
        return 'googleLive';
      case 'FREQUENCY':
        return 'frequency';
      default:
        return null;
    }
  }

  private serviceKeyName(slug: ServiceSlugKey): UrlSectionKey {
    switch (slug) {
      case 'yandex-xml':
        return 'yandex';
      case 'yandex-live':
        return 'yandexlive';
      case 'google-live':
        return 'google';
      case 'webmaster':
        return 'webmaster';
      case 'wordstat':
        return 'wordstat';
      default:
        return 'frequency';
    }
  }

  /**
   * Формирование URL под конкретный сервис:
   * - GET (default)
   * - POST-only (frequency)
   * - async status
   */
  private buildMethodUrls(
    base: string,
    slug: ServiceSlugKey,
    userId: number,
    apiKey: string,
  ): UrlMethodBlock {
    const main = new URL(SERVICES[slug].publicPath, base);
    main.searchParams.set('user', String(userId));
    main.searchParams.set('key', apiKey);

    // POST-only сервисы (frequency)
    if (POST_ONLY.has(slug)) {
      const block: UrlMethodBlock = {
        xml: main.toString(),
      };

      if (ASYNC.has(slug)) {
        const s = new URL(`${SERVICES[slug].publicPath}/status`, base);
        s.searchParams.set('user', String(userId));
        s.searchParams.set('key', apiKey);
        s.searchParams.set('taskId', '');
        block.status = s.toString();
      }

      return block;
    }

    // обычный GET
    const block: UrlMethodBlock = { xml: main.toString() };

    if (ASYNC.has(slug)) {
      const s = new URL(`${SERVICES[slug].publicPath}/status`, base);
      s.searchParams.set('user', String(userId));
      s.searchParams.set('key', apiKey);
      s.searchParams.set('id', '');
      block.status = s.toString();
    }

    return block;
  }

  private async pickActiveTariff(userId: number): Promise<{
    ut: UserTariff | null;
    tariff: Tariff | null;
  }> {
    const utRepo = this.ds.getRepository(UserTariff);
    const tariffRepo = this.ds.getRepository(Tariff);
    const nowISO = new Date().toISOString();

    const ut = await utRepo
      .createQueryBuilder('ut')
      .where('ut.userId = :userId', { userId })
      .andWhere('ut.status = :st', { st: 'ACTIVE' })
      .andWhere('ut.startsAt <= :now AND ut.expiresAt > :now', { now: nowISO })
      .orderBy('ut.expiresAt', 'DESC')
      .getOne();

    if (!ut) {
      const baseTariff = await tariffRepo.findOne({ where: { code: 'NONE' } });
      return { ut: null, tariff: baseTariff ?? null };
    }

    const t = await tariffRepo.findOne({ where: { id: ut.tariffId } });
    return { ut, tariff: t ?? null };
  }

  private async sumDebitsToday(
    userId: number,
    serviceCode: string,
  ): Promise<bigint> {
    type RowSum = { s: string | number | null };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows: RowSum[] = await this.ds.query(
      `
      SELECT COALESCE(SUM(ABS("amount")::bigint), 0)::bigint AS s
      FROM billing_transactions
      WHERE "userId" = $1
        AND service = $2
        AND kind = 'DEBIT'
        AND state = 'POSTED'
        AND "createdAt" >= $3
      `,
      [userId, serviceCode, startOfDay.toISOString()],
    );

    const v = rows?.[0]?.s;
    if (typeof v === 'string') return BigInt(v);
    if (typeof v === 'number') return BigInt(v);
    return 0n;
  }

  private safeDiv(n: bigint, d: bigint): bigint {
    return d > 0n ? n / d : 0n;
  }

  /**
   * Возвращаем структуру info для /public/info
   */
  async buildUserInfoPayload(apiKey: string, softId?: string, req?: Request) {
    const profile = await this.users.findByApiKey(apiKey);
    if (!profile) throw new NotFoundException('invalid key');

    const userId = profile.userId;
    const roles = profile.roles ?? [];
    const base = this.baseUrl(req);
    const { ut, tariff } = await this.pickActiveTariff(userId);

    const urls: Partial<Record<UrlSectionKey, UrlSection>> = {};

    for (const slug of EXPOSED) {
      const desc = SERVICES[slug as ServiceSlugKey];

      const tariffId = ut?.tariffId ?? tariff?.id ?? null;

      let unitPriceStr = '0';
      if (tariffId !== null) {
        unitPriceStr = await this.tariffs.getPrice(tariffId, desc.code);
      }

      let price = 0n;
      try {
        price = BigInt(unitPriceStr);
      } catch {
        price = 0n;
      }

      const spentToday = await this.sumDebitsToday(userId, desc.code);
      const queriesToday = this.safeDiv(spentToday, price);

      const secKey = this.serviceKeyName(slug);

      urls[secKey] = {
        method: this.buildMethodUrls(base, slug, userId, apiKey),
        price: unitPriceStr,
        query_today: queriesToday.toString(),
        query_today_limit: '0',
        request_limit: String(await this.requestLimitFor(desc.code, roles)),
      };
    }

    return {
      status: 'ok' as const,
      user: {
        key: apiKey,
        id: String(userId),
        tariff: {
          name: tariff?.name ?? 'Базовый',
          cost: '0',
          start: ut?.startsAt?.toISOString?.() ?? '',
          end: ut?.expiresAt?.toISOString?.() ?? '',
        },
      },
      urls,
      ...(softId ? { soft_id: softId } : {}),
    };
  }

  private async requestLimitFor(
    code: string,
    roles: string[],
  ): Promise<number> {
    const key = this.requestLimitKeyFor(code);
    if (key) {
      return this.limits.getServiceRequestLimit(key, roles);
    }
    return Number(this.cfg.get('DEFAULT_REQUEST_LIMIT', 30));
  }

  /**
   * Баланс (/public/info/balance)
   */
  async buildBalancePayload(
    apiKey: string,
  ): Promise<{ balance: string; tariffBalance: string }> {
    const profile = await this.users.findByApiKey(apiKey);
    if (!profile) throw new NotFoundException('invalid key');

    type BalanceRow = { balance: string };

    const row = await this.ds
      .getRepository(User)
      .createQueryBuilder('u')
      .select('u.balance', 'balance')
      .where('u.id = :id', { id: profile.userId })
      .getRawOne<BalanceRow>();

    return {
      balance: row?.balance ?? '0',
      tariffBalance: '0',
    };
  }
}
