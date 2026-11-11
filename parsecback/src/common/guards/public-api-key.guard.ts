import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Request, Response } from 'express';
import type { ParsedQs } from 'qs';
import { UsersService } from '@/modules/users/users.service';
import { buildYandexXmlError } from '@/modules/public-api/xml/yandex-xml';
import { sha256Hex } from '@/shared/utils/crypto';

type ReqQ = Record<string, unknown> | ParsedQs;

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length && typeof v[0] === 'string') return v[0];
  return undefined;
}

function readUserId(req: Request): number | null {
  const fromParams = (req.params as Record<string, unknown> | undefined)?.[
    'userId'
  ];
  const fromQuery = (req.query as ReqQ | undefined)?.['user'];
  const raw = firstString(fromParams) ?? firstString(fromQuery);
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readApiKey(req: Request): string | null {
  const h = req.header('x-api-key');
  const q = firstString((req.query as ReqQ | undefined)?.['key']);
  const v = (h ?? q)?.trim();
  return v || null;
}

// 🗝️ Человекочитаемые тексты ошибок (русские)
const RU_MESSAGES: Record<string, string> = {
  invalid_user_id: 'Некорректный идентификатор пользователя (user)',
  missing_api_key: 'Не передан параметр key или заголовок X-API-KEY',
  bad_api_key: 'Неверный или истёкший ключ API',
  unknown_error: 'Внутренняя ошибка проверки ключа',
};

const API_KEY_CACHE_TTL_MS = 30 * 1000;
const apiKeyCacheKey = (userId: number, rawKey: string): string =>
  `public-api-key:v1:${userId}:${sha256Hex(rawKey)}`;

type PublicApiAuthCache = {
  ok: true;
  roles: string[];
};

async function getCachedAuth(
  cache: Cache,
  key: string,
): Promise<PublicApiAuthCache | null> {
  try {
    const cached = await cache.get<PublicApiAuthCache>(key);
    return cached?.ok === true && Array.isArray(cached.roles) ? cached : null;
  } catch {
    return null;
  }
}

async function setCachedAuth(
  cache: Cache,
  key: string,
  auth: PublicApiAuthCache,
): Promise<void> {
  try {
    await cache.set(key, auth, API_KEY_CACHE_TTL_MS);
  } catch {
    // Cache is only an optimization; auth must continue through the DB path.
  }
}

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  private readonly inflight = new Map<
    string,
    Promise<PublicApiAuthCache | null>
  >();

  constructor(
    private readonly users: UsersService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { userId?: number }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const path = String(req.path || '');

    const sendXmlError = (code: number, key: string): false => {
      const message = RU_MESSAGES[key] ?? key;
      if (path.startsWith('/public/')) {
        const xml = buildYandexXmlError(code, message, {
          query: (req.query.query as string) || '',
          page: Number(req.query.page) || 0,
        });
        res
          .status(200)
          .setHeader('Content-Type', 'application/xml; charset=utf-8')
          .send(xml);
        return false;
      }
      return false;
    };

    try {
      const userId = readUserId(req);
      if (!userId) return sendXmlError(401, 'invalid_user_id');

      const apiKey = readApiKey(req);
      if (!apiKey) return sendXmlError(401, 'missing_api_key');

      const auth = await this.validateCached(userId, apiKey);
      if (!auth) return sendXmlError(401, 'bad_api_key');

      req.userId = userId;
      req.userRoles = auth.roles;
      return true;
    } catch {
      return sendXmlError(500, 'unknown_error');
    }
  }

  private async validateCached(
    userId: number,
    apiKey: string,
  ): Promise<PublicApiAuthCache | null> {
    const key = apiKeyCacheKey(userId, apiKey);

    const cached = await getCachedAuth(this.cache, key);
    if (cached) {
      return cached;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const pending = this.users
      .validatePublicApiKey(userId, apiKey)
      .then(async (auth) => {
        if (auth) {
          await setCachedAuth(this.cache, key, auth);
        }
        return auth;
      });

    this.inflight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.inflight.delete(key);
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
    userRoles?: string[];
  }
}
