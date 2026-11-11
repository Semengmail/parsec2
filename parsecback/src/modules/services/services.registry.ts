import type { ServiceCode } from '@/modules/tariffs/tariff.constants';

export type ServiceSlug =
  | 'yandex-live'
  | 'yandex-xml'
  | 'google-live'
  | 'webmaster'
  | 'wordstat'
  | 'frequency';

export type ServiceDescriptor = {
  code: ServiceCode;
  slug: ServiceSlug;
  title: string;
  publicPath: string; // относительный путь публичного API на нашем бэке
  method: 'GET' | 'POST';
  help: { title: string; href: string }[];
  supports: {
    device?: boolean;
    lr?: boolean;
    geo?: boolean; // latitude/longitude
    query?: boolean;
  };
};

export const SERVICES: Readonly<Record<ServiceSlug, ServiceDescriptor>> = {
  'yandex-live': {
    code: 'YANDEX_LIVE',
    slug: 'yandex-live',
    title: 'Яндекс Live',
    publicPath: '/public/yandexlive/xml',
    method: 'GET',
    help: [
      // { title: 'О сервисе Яндекс Live', href: '#' },
      // { title: 'Формат запроса', href: '#' },
      // { title: 'Коды ошибок', href: '#' },
      {
        title: 'Инструкция по  Яндекс Live',
        href: 'https://docs.google.com/document/d/1sPVLEyDgAl1zjof9qi1UmywF0XK1Hmghl72nvdP5FM8/edit?usp=sharing',
      },
    ],
    supports: { device: true, lr: true },
  },
  'yandex-xml': {
    code: 'YANDEX_XML_TOP100',
    slug: 'yandex-xml',
    title: 'XML Яндекс TOP-100',
    publicPath: '/public/yandex-xml/xml',
    method: 'GET',
    help: [
      {
        title: 'Документация XML',
        href: 'https://docs.google.com/document/d/1sPVLEyDgAl1zjof9qi1UmywF0XK1Hmghl72nvdP5FM8/edit?tab=t.0',
      },
    ],
    supports: { device: true, lr: true },
  },
  'google-live': {
    code: 'GOOGLE_LIVE',
    slug: 'google-live',
    title: 'Google Live',
    publicPath: '/public/googlelive/xml',
    method: 'GET',
    help: [
      {
        title: 'Инструкция по Google Live',
        href: 'https://docs.google.com/document/d/1IkjDU4DMzhaCmjZia6_xCi_K4mSVQFV0I7K_fx0an5E/edit?usp=sharing',
      },
    ],
    supports: { device: true, lr: true },
  },
  webmaster: {
    code: 'WEBMASTER',
    slug: 'webmaster',
    title: 'Вебмастер',
    publicPath: '/public/webmaster/xml',
    method: 'GET',
    help: [{ title: 'О сервисе Вебмастер', href: '#' }],
    supports: { device: true, lr: true },
  },
  wordstat: {
    code: 'WORDSTAT',
    slug: 'wordstat',
    title: 'Вордстат',
    publicPath: '/public/wordstat/xml',
    method: 'POST',
    help: [{ title: 'О сервисе Вордстат', href: '#' }],
    supports: { lr: true },
  },
  frequency: {
    code: 'FREQUENCY',
    slug: 'frequency',
    title: 'Сбор частоты',
    publicPath: '/public/frequency/json',
    method: 'POST',
    help: [
      {
        title: 'Инструкция по сбору частоты',
        href: 'https://docs.google.com/document/d/1uzcCyMTP3alt-SIsBo6CVPl2wpYpNIPUhiXbmOVrXdQ/edit?usp=sharing',
      },
    ],
    supports: { lr: true, device: false, geo: false, query: false },
  },
} as const;

export function getServiceBySlug(slug: string): ServiceDescriptor | null {
  return (SERVICES as Record<string, ServiceDescriptor>)[slug] ?? null;
}
