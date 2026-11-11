// src/app/reset-password/ResetPasswordClient.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Paper,
  Stack,
  Title,
  PasswordInput,
  Button,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { apiResetPassword } from '@/entities/user/api/auth-api';
import { Paths } from '@/shared/config/paths';

export default function ResetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const tokenStr = sp.get('token') ?? '';

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      password: '',
      confirm: '',
    },
    validate: {
      password: (v) => (v.length >= 6 ? null : 'Минимум 6 символов'),
      confirm: (v, values) =>
        v === values.password ? null : 'Пароли не совпадают',
    },
  });

  if (!tokenStr) {
    return (
      <Paper withBorder p="xl" maw={420} mx="auto" mt="xl">
        <Alert color="red">Некорректная ссылка восстановления</Alert>
      </Paper>
    );
  }

  async function onSubmit(values: typeof form.values) {
    setError(null);
    setLoading(true);
    try {
      await apiResetPassword(tokenStr, values.password);
      form.reset();
      router.replace(Paths.LOGIN);
    } catch {
      setError('Ссылка недействительна или устарела');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      <Stack>
        <Title order={3} ta="center">
          Новый пароль
        </Title>

        {error && <Alert color="red">{error}</Alert>}

        <form onSubmit={form.onSubmit(onSubmit)} aria-busy={loading}>
          <Stack>
            <PasswordInput
              label="Новый пароль"
              withAsterisk
              {...form.getInputProps('password')}
            />

            <PasswordInput
              label="Повторите пароль"
              withAsterisk
              {...form.getInputProps('confirm')}
            />

            <Button
              type="submit"
              loading={loading}
              disabled={!form.isValid() || loading}
            >
              Сохранить пароль
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
