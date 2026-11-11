'use client';

import { useState } from 'react';
import {
  Paper,
  Stack,
  Title,
  Text,
  TextInput,
  Button,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { apiForgotPassword } from '@/entities/user/api/auth-api';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { email: '' },
    validate: {
      email: (v) =>
        /^\S+@\S+\.\S+$/.test(v) ? null : 'Введите корректный email',
    },
  });

  async function onSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      await apiForgotPassword(values.email.trim());
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      <Stack>
        <Title order={3} ta="center">
          Восстановление пароля
        </Title>

        {sent ? (
          <Alert color="green">
            Если аккаунт с таким email существует — мы отправили письмо с
            инструкцией по восстановлению пароля.
          </Alert>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Укажите email, который вы использовали при регистрации.
            </Text>

            <form onSubmit={form.onSubmit(onSubmit)}>
              <Stack>
                <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  withAsterisk
                  {...form.getInputProps('email')}
                />

                <Button
                  type="submit"
                  loading={loading}
                  disabled={!form.isValid()}
                >
                  Отправить письмо
                </Button>
              </Stack>
            </form>
          </>
        )}
      </Stack>
    </Paper>
  );
}
