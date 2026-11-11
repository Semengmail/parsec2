import { buildYandexXmlError } from '../xml/yandex-xml';
import { ERROR_TEXTS_RU } from './error-texts.ru';

const tErr = (k: string) => ERROR_TEXTS_RU[k] ?? k;

export function mapErrorToXml(e: unknown, ctx: Record<string, any>): string {
  const msg = (e as Error)?.message?.toLowerCase?.() ?? '';

  if (msg.includes('invalid_lr'))
    return buildYandexXmlError(103, tErr('invalid_lr'), ctx);
  if (msg.includes('invalid_device'))
    return buildYandexXmlError(104, tErr('invalid_device'), ctx);
  if (msg.includes('invalid_groupby'))
    return buildYandexXmlError(102, tErr('invalid_groupby'), ctx);
  if (msg.includes('invalid_domain'))
    return buildYandexXmlError(106, tErr('invalid_domain'), ctx);

  if (msg.includes('insufficient_funds') || msg.includes('payment_required'))
    return buildYandexXmlError(200, tErr('insufficient_funds'), ctx);
  if (msg.includes('queue_overloaded'))
    return buildYandexXmlError(503, tErr('queue_overloaded'), ctx);

  if (msg.includes('rate_limited') || msg.includes('quota_exceeded'))
    return buildYandexXmlError(429, tErr('rate_limited'), ctx);
  if (msg.includes('bad_params') || msg.includes('invalid_param'))
    return buildYandexXmlError(400, tErr('bad_params'), ctx);
  if (msg.includes('remote_error'))
    return buildYandexXmlError(502, tErr('remote_error'), ctx);
  if (msg.includes('transient_fetch_failed'))
    return buildYandexXmlError(504, tErr('transient_fetch_failed'), ctx);
  if (msg.includes('missing_externaltaskid'))
    return buildYandexXmlError(107, tErr('missing_externalTaskId'), ctx);
  if (msg.includes('task_not_found'))
    return buildYandexXmlError(121, tErr('bad_request_id'), ctx);
  if (msg.includes('engine_blocked'))
    return buildYandexXmlError(503, tErr('engine_blocked'), ctx);

  return buildYandexXmlError(20, tErr('internal_error'), ctx);
}
