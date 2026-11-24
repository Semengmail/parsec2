import type { NextConfig } from 'next';

/**
 * Лендинг Парсека переехал на toolzar.ru/parsec. Главная этого приложения
 * отдаёт 301 туда; вход, регистрация, кабинет и документы остаются здесь.
 * Значение встраивается при build (routes-manifest), пустое — без редиректа.
 */
const landingUrl = process.env.PARSEC_LANDING_URL?.trim() ?? '';

if (landingUrl && !/^https?:\/\/[^/\s]+/.test(landingUrl)) {
  throw new Error(
    `PARSEC_LANDING_URL must be an absolute http(s) URL, got "${landingUrl}"`,
  );
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  allowedDevOrigins: [
    'parsec.toolzar.localhost',
    '*.local-origin.dev',
    'localhost',
    '127.0.0.1',
  ],
  async redirects() {
    if (!landingUrl) return [];
    // Строку запроса (?ref, utm_*) Next переносит в destination сам.
    return [{ source: '/', destination: landingUrl, statusCode: 301 }];
  },
};

export default nextConfig;
