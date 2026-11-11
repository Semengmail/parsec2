import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { buildYandexXmlError } from '@/modules/public-api/xml/yandex-xml';

// Маппинг коротких кодов → русский текст
const RU_MESSAGES: Record<string, string> = {
  empty_query: 'Не передан поисковый запрос (query)',
  invalid_lr: 'Некорректный регион lr (допустимы значения 1–99999999)',
  invalid_device: 'Некорректное устройство (ожидалось desktop или mobile)',
  invalid_groupby:
    'Некорректное значение groupby (допустимы 10, 20, 30, 50, 100)',
  invalid_domain:
    'Некорректный домен — используйте формат example.com или 1 (id)',
  queue_overloaded: 'Очередь сервиса перегружена, попробуйте повторить позже',
  missing_externalTaskId:
    'Ошибка при создании задачи: отсутствует внешний идентификатор',
  transient_fetch_failed:
    'Ошибка соединения с внешним сервисом (timeout или сеть)',
  bad_params: 'Некорректные параметры запроса',
  rate_limited: 'Превышен лимит запросов (rate limit)',
  quota_exceeded: 'Превышена квота сервиса (quota exceeded)',
  remote_error: 'Внешний сервис вернул ошибку',
  insufficient_funds: 'Недостаточно средств на балансе',
  task_not_found: 'Задача не найдена',
  internal_error: 'Внутренняя ошибка сервера',
  engine_blocked: 'Поисковая система временно недоступна. Мы уже разбираемся!',
};

@Catch()
@Injectable()
export class PublicXmlExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'internal_error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse() as unknown;

      if (typeof payload === 'object' && payload !== null) {
        const msg = (payload as Record<string, unknown>)['message'];
        if (Array.isArray(msg)) {
          message = msg.join('; ');
        } else if (typeof msg === 'string') {
          message = msg;
        } else {
          message = exception.message;
        }
      } else if (typeof payload === 'string') {
        message = payload;
      } else {
        message = exception.message;
      }
    }

    // если нашли перевод → заменим
    const lower = message.toLowerCase().trim();
    const translated = RU_MESSAGES[lower] ?? RU_MESSAGES[message] ?? null;
    if (translated) message = translated;

    const code: number =
      statusCode >= 400 && statusCode < 600 ? statusCode : 500;

    const xml = buildYandexXmlError(code, message);

    res
      .status(200)
      .setHeader('Content-Type', 'application/xml; charset=utf-8')
      .send(xml);
  }
}
