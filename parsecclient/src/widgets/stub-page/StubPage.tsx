'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Anchor, Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { apiLogout } from '@/entities/user/api/auth-api';
import { useAuthStore } from '@/entities/user/model/use-auth-store';
import { Paths } from '@/shared/config/paths';
import { SUPPORT_CONTACT } from '@/shared/config/support';

export const STUB_TEXTS = {
  brand: 'Парсек',
  title: 'Парсек на техническом обслуживании',
  message: 'Мы восстанавливаем сервис. Ваш аккаунт и баланс сохранены, собирать данные пока нельзя. Напишите нам, если хотите узнать о запуске первыми:',
  contact: SUPPORT_CONTACT.handle,
  contactUrl: SUPPORT_CONTACT.url,
  logout: 'Выйти',
  logoutError: 'Не удалось выйти. Попробуйте ещё раз.',
};

export function StubPage() {
  const router = useRouter();
  const logoutLocal = useAuthStore((state) => state.logoutLocal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function logout() {
    setLoading(true);
    setError(false);
    try {
      await apiLogout();
      logoutLocal();
      router.replace(Paths.LOGIN);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm" py={80}>
      <Paper withBorder radius="md" p="xl">
        <Stack gap="lg" align="flex-start">
          <Text fw={700} size="xl">{STUB_TEXTS.brand}</Text>
          <Title order={1}>{STUB_TEXTS.title}</Title>
          <Text>{STUB_TEXTS.message}{' '}<Anchor href={STUB_TEXTS.contactUrl} target="_blank" rel="noopener noreferrer">{STUB_TEXTS.contact}</Anchor></Text>
          {error && <Alert color="red">{STUB_TEXTS.logoutError}</Alert>}
          <Button onClick={logout} loading={loading}>{STUB_TEXTS.logout}</Button>
        </Stack>
      </Paper>
    </Container>
  );
}
