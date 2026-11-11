import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_TEXTS_RU } from '@/modules/public-api/helpers/error-texts.ru';

const SILENT_404_PATHS = new Set([
  '/favicon.ico',
  '/.well-known/appspecific/com.chrome.devtools.json',
]);

function humanizeMessage(msg: unknown): string {
  const raw = (typeof msg === 'string' ? msg : '').toLowerCase();
  if (!raw) return 'Внутренняя ошибка';
  // выдернем ключ ошибки (как мы кидаем в сервисах)
  const key = raw.replace(/[^a-z_]/g, '');
  return ERROR_TEXTS_RU[key] ?? raw;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private isNoisyBrowser404(status: number, req: Request): boolean {
    return (
      status === Number(HttpStatus.NOT_FOUND) && SILENT_404_PATHS.has(req.path)
    );
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // исходный ответ исключения: string | object
    const raw = isHttp
      ? exception.getResponse()
      : { message: 'internal_error' };
    // приводим к объекту (если была строка — упакуем как { message: string })
    const payload: Record<string, unknown> =
      typeof raw === 'string'
        ? { message: raw }
        : (raw as Record<string, unknown>);

    const stack = exception instanceof Error ? exception.stack : undefined;

    if (!this.isNoisyBrowser404(status, req)) {
      this.logger.error(
        `HTTP ${status} ${req.method} ${req.url} - ${JSON.stringify(payload)}`,
        stack,
      );
    }

    // ответ клиенту
    const rawMessage = (payload && payload.message) ?? undefined;
    const message = Array.isArray(rawMessage)
      ? rawMessage.map(humanizeMessage)
      : humanizeMessage(rawMessage);

    res.status(status).json({
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      message,
      code:
        typeof rawMessage === 'string'
          ? rawMessage.replace(/[^a-z_]/g, '')
          : undefined,
    });
  }
}
