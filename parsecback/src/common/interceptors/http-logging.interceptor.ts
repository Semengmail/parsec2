// src/common/interceptors/http-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly log = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();

    const started = Date.now();

    const method = req.method;
    const originalUrl =
      (req as { originalUrl?: string }).originalUrl ?? req.url;

    const userId = this.extractUserId(req);
    const ip = this.getClientIp(req);
    const { stamp, tzName, tzOffset } = this.nowWithTz();

    // аккуратно сериализуем query/params (без body)
    const q = safeJson(req.query);
    const p = safeJson(req.params);

    this.log.debug(
      `→ ${method} ${originalUrl} uid=${userId} ip=${ip} ts=${stamp} tz=${tzName} offset=${tzOffset} q=${q} p=${p}`,
    );

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - started;
        this.log.log(
          `← ${method} ${originalUrl} ${res.statusCode} ${ms}ms uid=${userId} ip=${ip}`,
        );
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - started;
        const status = this.getErrorStatus(err);
        const msg = this.getErrorMessage(err);
        this.log.error(
          `× ${method} ${originalUrl} ${status} ${ms}ms uid=${userId} ip=${ip} msg=${msg}`,
        );
        return throwError(() => err);
      }),
    );
  }

  /** Достаём userId из нескольких возможных мест без any */
  private extractUserId(req: Request): string {
    // расширяем тип без any: читаем как unknown и сужаем
    const r = req as Request & { userId?: unknown; user?: unknown };
    const { userId, user } = r;

    const fromUserId =
      typeof userId === 'number' || typeof userId === 'string'
        ? String(userId)
        : null;

    if (fromUserId) return fromUserId;

    if (typeof user === 'number' || typeof user === 'string') {
      return String(user);
    }
    if (user && typeof user === 'object' && 'id' in user) {
      const id = (user as Record<string, unknown>)['id'];
      if (typeof id === 'number' || typeof id === 'string') {
        return String(id);
      }
    }
    return '-';
  }

  /** Корректно определяем IP (учитываем X-Forwarded-For) */
  private getClientIp(req: Request): string {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.length) {
      // берём первый IP из списка
      const first = xf.split(',')[0]?.trim();
      if (first) return first;
    }
    if (Array.isArray(xf) && xf.length > 0) {
      const first = xf[0]?.trim();
      if (first) return first;
    }
    return (req.ip || req.socket.remoteAddress || '-').toString();
  }

  /** Время c офсетом и именем таймзоны (серверной) */
  private nowWithTz(): { stamp: string; tzName: string; tzOffset: string } {
    const d = new Date();
    const offMin = -d.getTimezoneOffset(); // например, 180 для +03:00
    const sign = offMin >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(offMin) / 60)).padStart(2, '0');
    const mm = String(Math.abs(offMin) % 60).padStart(2, '0');
    const tzOffset = `${sign}${hh}:${mm}`;
    const iso = d.toISOString().replace('Z', tzOffset);

    // имя таймзоны у сервера (если доступно)
    const tzName =
      (Intl.DateTimeFormat().resolvedOptions().timeZone as
        | string
        | undefined) ?? 'UTC';

    return { stamp: iso, tzName, tzOffset };
  }

  /** Безопасно получаем HTTP-статус из ошибки */
  private getErrorStatus(err: unknown): number {
    if (err && typeof err === 'object') {
      const maybe = err as Record<string, unknown>;
      const s1 = maybe['status'];
      if (typeof s1 === 'number') return s1;
      const s2 = maybe['statusCode'];
      if (typeof s2 === 'number') return s2;
    }
    return 500;
  }

  /** Человечный текст ошибки без any */
  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}

/** Безопасная сериализация объектов в одну строку */
function safeJson(obj: unknown): string {
  try {
    const s = JSON.stringify(obj);
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  } catch {
    return '[unserializable]';
  }
}
