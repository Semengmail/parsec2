// src/modules/frequency/frequency.errors.ts

export type ApiErrorResponse = {
  status: 'error';
  code: number | string;
  error: string;
};

export type ApiOkResponse<T> = {
  status: 'ok';
} & T;

/**
 * Коды ошибок (формат близок к Topvisor, плюс свои).
 */
export const ERROR_CODES = {
  SERVICE_UNAVAILABLE: 52,
  UNKNOWN: 0,

  INTERNAL_ERROR: 10001,

  AUTH_ERROR: 53,
  NO_RIGHTS: 54,

  BAD_REQUEST_NAME: 1000,
  BAD_OPERATOR: 1001,
  BAD_SERVICE: 1002,
  BAD_METHOD: 1003,
  BAD_VERSION: 1004,

  BAD_DATA_FORMAT: 2000,
  MISSING_PARAM: 2001,
  BAD_TYPE: 2002,
  BAD_VALUE: 2003,
  BAD_FILTERS: 2004,
  BAD_PAGINATION: 2005,

  INSUFFICIENT_FUNDS: 2010,
  WORDSTAT_NOT_IMPLEMENTED: 2011,
  GOOGLE_NOT_SUPPORTED: 2012,
  EMPTY_QUERY: 2013,
  INVALID_CITY: 2014,
  INVALID_FREQUENCY_TYPE: 2015,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function makeError(code: ErrorCode, message: string): ApiErrorResponse {
  return {
    status: 'error',
    code,
    error: message,
  };
}
