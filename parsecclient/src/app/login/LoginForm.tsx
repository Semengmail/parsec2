'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from '@mantine/form';
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Stack,
  Title,
  Alert,
  Group,
  Anchor,
} from '@mantine/core';
import { useState } from 'react';
import { apiLogin, apiMe } from '@/entities/user/api/auth-api';
import { useAuthStore } from '@/entities/user/model/use-auth-store';
import { getErrorMessage } from '@/shared/utils/errors/getErrorMessage';
import { Paths } from '@/shared/config/paths';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const sp = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) =>
        /^\S+@\S+\.\S+$/.test(v) ? null : 'Введите корректный email',
      password: (v) => (v.length >= 6 ? null : 'Минимум 6 символов'),
    },
  });

  async function onSubmit(values: typeof form.values) {
    setError(null);
    setSubmitting(true);
    try {
      await apiLogin(values.email, values.password);
      const { user } = await apiMe(); // HttpOnly-кука уже установлена
      setUser(user);
      const next = process.env.NEXT_PUBLIC_STUB_MODE === 'true'
        ? Paths.DASHBOARD
        : sp.get('next') || Paths.DASHBOARD;
      router.replace(next);
      router.refresh();
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      setError(msg ?? 'Ошибка авторизации');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      <Stack>
        <Title order={3} ta="center">
          Вход в аккаунт
        </Title>

        {error && <Alert color="red">{error}</Alert>}

        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              withAsterisk
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Пароль"
              placeholder="Ваш пароль"
              withAsterisk
              {...form.getInputProps('password')}
            />
            <Button
              type="submit"
              loading={submitting}
              disabled={!form.isValid()}
            >
              Войти
            </Button>
          </Stack>
        </form>

        <Group justify="space-between" mt="xs">
          <Anchor size="sm" href={Paths.FORGOT_PASSWORD}>
            Забыли пароль?
          </Anchor>

          <Group gap="xs">
            <span>Нет аккаунта?</span>
            <Anchor href={Paths.REGISTER}>Зарегистрироваться</Anchor>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
};
