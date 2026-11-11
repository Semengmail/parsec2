import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { buildYandexXmlError } from '@/modules/public-api/xml/yandex-xml';
import { COMMON_PUBLIC_ERROR_TEXTS } from '@/modules/public-api/helpers/common-public-errors.ru';
import { GOOGLELIVE_ERROR_TEXTS } from '@/modules/public-api/helpers/googlelive-errors.ru';

@Catch()
export class PublicXmlGlobalFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const path = String(req.path || req.url || '');

    const isPublic = path.startsWith('/public/');

    if (!isPublic) {
      // throw exception; // отдаём дальше JSON-фильтрам
      return;
    }
    if (res.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') message = resp;
      else if (typeof resp === 'object' && resp && 'message' in resp) {
        const m = (resp as Record<string, unknown>).message;
        message = Array.isArray(m) ? m.join(', ') : String(m);
      } else message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    } else {
      message = 'internal_error';
    }

    const msgKey = String(message).trim().toLowerCase();

    let ru: string | undefined;

    // 1️⃣ Попробуем по ключу (строгое совпадение)
    ru = COMMON_PUBLIC_ERROR_TEXTS[msgKey] ?? GOOGLELIVE_ERROR_TEXTS[msgKey];

    // 2️⃣ Если нет, попробуем по фразам
    if (!ru) {
      if (message.includes('device must be one of')) {
        ru = 'Некорректный тип устройства (desktop или mobile)';
      } else if (message.includes('lr')) {
        ru = 'Неверный код региона (lr)';
      }
    }

    // 3️⃣ Если ничего не нашли, fallback
    if (!ru) {
      ru =
        mapHttpStatusToRu(status) ?? COMMON_PUBLIC_ERROR_TEXTS.internal_error;
    }

    const xml = buildYandexXmlError(status, ru, {
      query: extractQuery(req.query),
      page: extractPage(req.query),
    });

    res
      .status(200)
      .setHeader('Content-Type', 'application/xml; charset=utf-8')
      .send(xml);
  }
}

function extractQuery(q: unknown): string | undefined {
  if (q && typeof q === 'object' && 'query' in q) {
    const v = (q as Record<string, unknown>).query;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

function extractPage(q: unknown): number | undefined {
  if (q && typeof q === 'object' && 'page' in q) {
    const v = (q as Record<string, unknown>).page;
    if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
    if (typeof v === 'number' && Number.isInteger(v)) return v;
  }
  return undefined;
}

function mapHttpStatusToRu(code: number): string {
  switch (code) {
    case 400:
      return 'Некорректный запрос';
    case 401:
      return 'Неверный или истёкший ключ API';
    case 403:
      return 'Доступ запрещён';
    case 404:
      return 'Метод не найден';
    case 429:
      return 'Слишком много запросов';
    case 500:
      return 'Внутренняя ошибка сервера';
    default:
      return 'Неизвестная ошибка';
  }
}
