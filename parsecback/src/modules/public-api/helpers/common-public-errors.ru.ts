// src/modules/public-api/helpers/common-public-errors.ru.ts
export const COMMON_PUBLIC_ERROR_TEXTS: Record<string, string> = {
  // Аутентификация / доступ
  bad_api_key: 'Неверный или истёкший ключ API',
  forbidden: 'Доступ запрещён',
  unauthorized: 'Неверный или истёкший ключ API',

  // Общие статусы сервиса/сети
  service_unavailable: 'Сервис временно недоступен',
  too_many_requests: 'Слишком много запросов, попробуйте позже',
  internal_error: 'Внутренняя ошибка сервера',

  // Унификация с вашими короткими кодами
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
  engine_blocked: 'Поисковая система временно недоступна. Мы уже разбираемся.',
  task_not_found: 'Задача не найдена',
};
