// src/modules/public-api/helpers/googlelive-errors.ru.ts

/** Маппинг коротких внутренних кодов GoogleLive → русских сообщений */
export const GOOGLELIVE_ERROR_TEXTS: Record<string, string> = {
  empty_query: 'Не передан поисковый запрос (query)',
  invalid_lr: 'Некорректный регион lr (допустимы значения 1–99999999)',
  invalid_device: 'Некорректное устройство (ожидалось desktop или mobile)',
  invalid_groupby:
    'Некорректное значение groupby (допустимы 10, 20, 30, 50, 100)',
  invalid_domain: 'Неверный формат домена',
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
  bad_api_key: 'Неверный или истёкший ключ API',
};
