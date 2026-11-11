import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface PublicInfoErrorResponse {
  status: 'error';
  user: { key: string };
  code: string;
  error: string;
}

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch() // перехватываем любые исключения в рамках контроллера
export class PublicInfoErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const keyParam = req.query?.key;
    const key = typeof keyParam === 'string' ? keyParam : '';

    const { code, message } = mapToXmlStockError(exception);

    const body: PublicInfoErrorResponse = {
      status: 'error',
      user: { key },
      code,
      error: message,
    };

    // Всегда HTTP 200 — как у XMLStock
    res.status(200).json(body);
  }
}

/** Маппинг исключений → xmlstock-коды и русские сообщения */
function mapToXmlStockError(ex: unknown): { code: string; message: string } {
  // 1️⃣ HttpException
  if (ex instanceof HttpException) {
    const raw = ex.getResponse();
    let statusMsg = '';

    if (typeof raw === 'string') {
      statusMsg = raw;
    } else if (typeof raw === 'object' && raw !== null) {
      const obj = raw as HttpExceptionBody;
      if (typeof obj.message === 'string') statusMsg = obj.message;
      else if (Array.isArray(obj.message)) statusMsg = obj.message.join(', ');
      else if (typeof obj.error === 'string') statusMsg = obj.error;
    }

    // 🆕 Проверка на отсутствие обязательных параметров
    if (includes(statusMsg, 'обязателен') || includes(statusMsg, 'required')) {
      // Пример: "Параметр key обязателен"
      return { code: '34', message: statusMsg };
    }

    if (includes(statusMsg, 'invalid key')) {
      return { code: '31', message: 'Пользователь не найден' };
    }
    if (includes(statusMsg, 'unsupported info')) {
      return { code: '32', message: 'Неверный параметр info' };
    }
    if (includes(statusMsg, 'unknown_service')) {
      return { code: '43', message: 'Метод недоступен' };
    }
    if (includes(statusMsg, 'Недостаточный баланс')) {
      return { code: '41', message: 'Превышен лимит или недостаточно средств' };
    }
    if (includes(statusMsg, 'доступ')) {
      return { code: '42', message: 'Доступ запрещён' };
    }
    if (includes(statusMsg, 'Тариф') || includes(statusMsg, 'tariff')) {
      return { code: '33', message: 'Ошибка тарифа' };
    }
    if (
      includes(statusMsg, 'Неверный параметр') ||
      includes(statusMsg, 'валидац')
    ) {
      return { code: '34', message: 'Неверные параметры запроса' };
    }

    return { code: '50', message: 'Внутренняя ошибка сервера' };
  }

  // 2️⃣ Не-HttpException
  const message =
    ex &&
    typeof ex === 'object' &&
    'message' in ex &&
    typeof (ex as { message?: unknown }).message === 'string'
      ? (ex as { message: string }).message
      : '';

  const name =
    ex &&
    typeof ex === 'object' &&
    'name' in ex &&
    typeof (ex as { name?: unknown }).name === 'string'
      ? (ex as { name: string }).name
      : '';

  if (
    name === 'QueryFailedError' ||
    includes(message, 'ECONNREFUSED') ||
    includes(message, 'timeout')
  ) {
    return { code: '51', message: 'База данных недоступна' };
  }
  if (includes(message, 'connect') || includes(message, 'ENOTFOUND')) {
    return { code: '52', message: 'Сервис временно недоступен' };
  }

  // 3️⃣ Абсолютный дефолт
  return { code: '50', message: 'Внутренняя ошибка сервера' };
}

/** Безопасная подстрочная проверка без any */
function includes(hay: unknown, needle: string): boolean {
  if (typeof hay !== 'string') return false;
  try {
    return hay.toLowerCase().includes(needle.toLowerCase());
  } catch {
    return false;
  }
}
