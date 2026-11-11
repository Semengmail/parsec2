export type ServiceCode =
  | 'YANDEX_XML_TOP100' // XML Яндекс топ-100 (xmlstock)
  | 'YANDEX_LIVE' // Живая выдача Яндекс (Яндекс 1 стр.)
  | 'GOOGLE_LIVE' // Живая выдача Google
  | 'WEBMASTER' // Вебмастер (по фразе)
  | 'WORDSTAT' // Вордстат (частоты и запросы)
  | 'FREQUENCY'; // Сбор частоты (отдельный инструмент)

export const ALL_SERVICES: readonly ServiceCode[] = [
  'YANDEX_XML_TOP100',
  'YANDEX_LIVE',
  'GOOGLE_LIVE',
  'WEBMASTER',
  'WORDSTAT',
  'FREQUENCY',
] as const;
