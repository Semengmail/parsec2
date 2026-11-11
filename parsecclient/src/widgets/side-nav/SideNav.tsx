// src/widgets/side-nav/SideNav.tsx
'use client';

import { useState } from 'react';
import { Paper, NavLink, Button, Stack } from '@mantine/core';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Paths } from '@/shared/config/paths';
import { useAuthStore } from '@/entities/user/model/use-auth-store';

type Item = { label: string; href: string };

const items: readonly Item[] = [
  { label: 'Обзор', href: Paths.DASHBOARD },
  // { label: 'XML Яндекс TOP-100', href: Paths.XML_YANDEX },
  { label: 'Живая выдача Яндекс', href: Paths.LIVE_YANDEX },
  { label: 'Живая выдача Google', href: Paths.LIVE_GOOGLE },
  // { label: 'Вебмастер', href: Paths.WEBMASTER },
  // { label: 'Вордстат', href: Paths.WORDSTAT },
  { label: 'Сбор частоты', href: Paths.FREQUENCY },
] as const;

export function SideNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? 80 : 240;
  const user = useAuthStore().user;

  return (
    <Paper
      component="aside"
      withBorder
      p="sm"
      role="navigation"
      aria-label="Разделы"
      style={{
        width,
        minHeight: '100dvh',
        display: 'flex',
      }}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        <Button
          size="xs"
          variant="light"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {collapsed ? '→' : '←'}
        </Button>

        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <NavLink
              key={it.href}
              component={Link}
              href={it.href}
              label={collapsed ? undefined : it.label}
              title={it.label}
              active={active}
              // Чтобы при свёрнутом меню был компактный вид
              style={{ justifyContent: 'center' }}
            />
          );
        })}
        {user?.softId && (
          <NavLink
            key="partner"
            component={Link}
            href={Paths.PARTNER}
            label="Доходы по партнерке"
          />
        )}
      </Stack>
    </Paper>
  );
}
