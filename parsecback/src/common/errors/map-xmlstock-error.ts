// src/common/errors/map-xmlstock-error.ts
import { HttpException } from '@nestjs/common';

import { ERROR_CODES } from '@/modules/frequency/frequency.errors';

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export function mapToXmlStockError(ex: unknown): {
  code: string;
  message: string;
} {
  // 1) HttpException
  if (ex instanceof HttpException) {
    const raw = ex.getResponse();
    let msg = '';

    if (typeof raw === 'string') {
      msg = raw;
    } else if (raw && typeof raw === 'object') {
      const body = raw as HttpExceptionBody;

      if (typeof body.message === 'string') {
        msg = body.message;
      } else if (Array.isArray(body.message)) {
        msg = body.message.join(', ');
      } else if (typeof body.error === 'string') {
        msg = body.error;
      }
    }

    // примеры маппинга на xmlstock-коды
    if (contains(msg, 'обязателен') || contains(msg, 'required')) {
      return { code: '34', message: msg };
    }

    if (contains(msg, 'invalid key')) {
      return { code: '31', message: 'Пользователь не найден' };
    }

    if (contains(msg, 'Недостаточный баланс')) {
      return { code: '41', message: 'Превышен лимит или недостаточно средств' };
    }

    if (contains(msg, 'доступ')) {
      return { code: '42', message: 'Доступ запрещён' };
    }

    if (contains(msg, 'Неверный параметр') || contains(msg, 'валидац')) {
      return { code: '34', message: 'Неверные параметры запроса' };
    }

    // return { code: '50', message: 'Внутренняя ошибка сервера' };
    return {
      code: String(ERROR_CODES.INTERNAL_ERROR), // "10001"
      message: 'Внутренняя ошибка сервера',
    };
  }

  // 2) Не HttpException
  const msg =
    ex &&
    typeof ex === 'object' &&
    'message' in ex &&
    typeof (ex as { message?: unknown }).message === 'string'
      ? (ex as { message: string }).message
      : '';

  if (contains(msg, 'ECONNREFUSED') || contains(msg, 'timeout')) {
    return { code: '52', message: 'Сервис временно недоступен' };
  }

  // 3) дефолт
  // return { code: '50', message: 'Внутренняя ошибка сервера' };
  return {
    code: String(ERROR_CODES.INTERNAL_ERROR), // "10001"
    message: 'Внутренняя ошибка сервера',
  };
}

function contains(hay: unknown, needle: string): boolean {
  if (typeof hay !== 'string') return false;
  try {
    return hay.toLowerCase().includes(needle.toLowerCase());
  } catch {
    return false;
  }
}
