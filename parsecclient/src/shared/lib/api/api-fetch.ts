import { getErrorMessages } from '@/shared/utils/errors/getErrorMessage';
import { API_BASE } from '@/shared/config/env';

export interface ApiErrorPayload {
  message: string | string[];
  code?: string;
  errors?: Record<string, string[] | string>;
}

function isApiErrorPayload(x: unknown): x is ApiErrorPayload {
  if (typeof x !== 'object' || x === null) return false;
  const m = (x as { message?: unknown }).message;
  return (
    typeof m === 'string' ||
    (Array.isArray(m) && m.every((v) => typeof v === 'string'))
  );
}

async function safeJson(res: Response): Promise<unknown | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return API_BASE;
  }

  const { protocol, hostname } = window.location;

  // ===== LOCAL / STAGE =====
  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    return API_BASE;
  }

  // ===== PROD (.ru / .su) =====
  if (hostname.startsWith('parsec.')) {
    return `${protocol}//api.${hostname}`;
  }

  return API_BASE;
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const url = `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    } as HeadersInit,
    ...init,
  });

  const payload = await safeJson(res);

  if (!res.ok) {
    if (payload instanceof Error) {
      const errors = getErrorMessages(payload);
      console.error('Ошибка при отправке запроса', errors);
    }

    if (isApiErrorPayload(payload)) {
      const msgArray = Array.isArray(payload.message)
        ? payload.message
        : [payload.message];
      const composed =
        (payload.code ? `[${payload.code}] ` : '') + msgArray.join(', ');
      throw new Error(composed);
    }

    const extra =
      typeof payload === 'string' ? ` — ${payload.slice(0, 200)}` : '';
    throw new Error(`API ${res.status} ${res.statusText}${extra}`);
  }

  // 204/205/пустой ответ — позволяем вызывать с T=void
  if (res.status === 204 || res.status === 205 || payload === null) {
    return undefined as T;
  }

  return payload as T;
}
