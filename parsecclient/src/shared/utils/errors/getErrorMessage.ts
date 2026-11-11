// ----------------------------
// Типы
// ----------------------------

export type ErrorResponse = {
  code?: string | number;
  message: string;
  details?: string[];
};

interface BusinessError extends Error {
  code: string;
  metadata?: Record<string, unknown>;
}

// ----------------------------
// Вспомогательная функция: извлекаем "[code] msg"
// ----------------------------
function parseBracketErrorMessage(msg: string): {
  code?: string;
  message: string;
} {
  // Форматы:
  // [code] message
  // [code]
  // code: message

  // [code] message
  const bracketMatch = msg.match(/^\[(.+?)\]\s*(.*)$/);
  if (bracketMatch) {
    return {
      code: bracketMatch[1],
      message: bracketMatch[2] || bracketMatch[1], // если нет текста → использовать код
    };
  }

  // code: message
  const colonMatch = msg.match(/^([^:\s]+)\s*:\s*(.+)$/);
  if (colonMatch) {
    return {
      code: colonMatch[1],
      message: colonMatch[2],
    };
  }

  return { message: msg };
}

// ----------------------------
// Главная функция нормализации ошибки
// ----------------------------
export function normalizeError(error: unknown): ErrorResponse {
  // ---- Бизнес-ошибка (throw new BusinessError...) ----
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const bizError = error as BusinessError;
    return {
      code: bizError.code,
      message: bizError.message,
    };
  }

  // ---- Axios ошибка ----
  if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
    const axiosError = error as {
      response?: {
        data?: {
          message?: string;
          error?: string;
          code?: string | number;
          details?: string[];
        };
      };
      message?: string;
    };

    const msg =
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      'Неизвестная сетевая ошибка';

    return {
      code: axiosError.response?.data?.code || 'HTTP_ERROR',
      message: msg,
      details: axiosError.response?.data?.details,
    };
  }

  // ---- Ошибка RTK Query (unwrap) ----
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const rtkError = error as {
      data?: { message?: string; code?: string | number };
      status?: string | number;
    };

    return {
      code: rtkError.data?.code || rtkError.status || 'RTK_ERROR',
      message: rtkError.data?.message || 'Ошибка при выполнении запроса',
    };
  }

  // ---- Обычная JS ошибка ----
  if (error instanceof Error) {
    const parsed = parseBracketErrorMessage(error.message);
    return {
      code: parsed.code || 'JS_ERROR',
      message: parsed.message,
    };
  }

  // ---- Строковая ошибка ----
  if (typeof error === 'string') {
    const parsed = parseBracketErrorMessage(error);
    return {
      code: parsed.code || 'UNKNOWN_ERROR',
      message: parsed.message,
    };
  }

  // ---- Всё остальное ----
  return {
    code: 'UNKNOWN_ERROR',
    message: 'Неизвестная ошибка',
  };
}

// ----------------------------
// Мульти-формат (массива ошибок)
// ----------------------------
export function getErrorMessages(
  error: unknown
): Array<{ code?: string; message: string }> {
  const normalized = normalizeError(error);

  const result = [
    {
      code: normalized.code?.toString(),
      message: normalized.message,
    },
  ];

  if (normalized.details) {
    return result.concat(
      normalized.details.map((detail) => ({
        message: detail,
        code: undefined,
      }))
    );
  }

  return result;
}

// ----------------------------
// Старый API (возвращает только message строкой)
// ----------------------------
export function getErrorMessage(error: unknown): string {
  const n = normalizeError(error);
  return n.message;
}
