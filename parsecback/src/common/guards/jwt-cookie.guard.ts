// src/common/guards/jwt-cookie.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@/modules/auth/auth.service';
import type { Request as ExpressRequest } from 'express';
import type { ParsedQs } from 'qs';
import type { JwtSubPayload } from '@/modules/auth/types';
import { User } from '@/modules/users/entities/user.entity';

// Безопасная версия Express Request (убираем any из дженериков)
type SafeRequest = ExpressRequest<
  Record<string, unknown>, // Params
  unknown, // ResBody
  unknown, // ReqBody
  ParsedQs, // ReqQuery
  Record<string, unknown> // Locals
> & {
  userId?: number;
  user?: User; // 👈 добавляем user
};

// Безопасный парсер Cookie из заголовка
function getCookieFromHeader(
  req: SafeRequest,
  name: string,
): string | undefined {
  const header = req.headers['cookie'];
  if (!header) return undefined;
  for (const p of header.split(';')) {
    const part = p.trim();
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    const rawVal = part.slice(eq + 1);
    try {
      return decodeURIComponent(rawVal);
    } catch {
      return rawVal;
    }
  }
  return undefined;
}

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(
    private readonly cfg: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<SafeRequest>();

    const cookieName = this.cfg.get<string>('COOKIE_NAME', 'psk.sid');
    const token = getCookieFromHeader(req, cookieName);
    if (!token) throw new UnauthorizedException('no_token');

    // verifyToken возвращает JwtSubPayload
    const payload: JwtSubPayload = this.auth.verifyToken(token);
    if (typeof payload.sub !== 'number' || !Number.isInteger(payload.sub)) {
      throw new UnauthorizedException('invalid_token_payload');
    }

    // сохраняем ID
    req.userId = payload.sub;

    // 👇 пробуем загрузить пользователя сразу
    const user = await this.auth.findUserById?.(payload.sub);
    if (user) req.user = user;

    return true;
  }
}
