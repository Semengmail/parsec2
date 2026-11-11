import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from '@mantine/core';

import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';
import { AuthBootstrap } from './providers/AuthBootstrap';
import { TgButton } from '@/shared/ui';
import { SUPPORT_CONTACT } from '@/shared/config/support';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Parsec',
  description: 'Сервис для SEO-парсинга',
  icons: {
    icon: [
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicons/favicon.ico' },
    ],
    apple: [{ url: '/favicons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicons/favicon.ico'],
  },
  manifest: '/favicons/site.webmanifest',
  // ⚠ themeColor отсюда убираем
  other: {
    'msapplication-TileColor': '#081F20',
    'msapplication-config': '/favicons/browserconfig.xml',
  },
};

export const viewport: Viewport = {
  themeColor: '#081F20',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <MantineProvider>
          {/* бутстрап профиля */}
          <AuthBootstrap />
          <main>{children}</main>
        </MantineProvider>
        <div
          id="support-button"
          style={{ position: 'fixed', bottom: 20, right: 20 }}
        >
          <a href={SUPPORT_CONTACT.url} target="_blank" rel="noopener">
            <TgButton text="Чат поддержки" />
          </a>
        </div>
      </body>
    </html>
  );
}
