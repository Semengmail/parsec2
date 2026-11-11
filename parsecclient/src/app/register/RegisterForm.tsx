'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from '@mantine/form';
import {
  Paper,
  Stack,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Group,
  Anchor,
  Text,
  Checkbox,
} from '@mantine/core';

import { apiLogin, apiMe, apiRegister } from '@/entities/user/api/auth-api';
import { useAuthStore } from '@/entities/user/model/use-auth-store';
import { getErrorMessage } from '@/shared/utils/errors/getErrorMessage';
import { Paths } from '@/shared/config/paths';
import { validateReferralCode } from '@/entities/referral/api/referral.api';
import { IconCircleCheckFilled } from '@tabler/icons-react';

type FormValues = {
  email: string;
  name: string;
  password: string;
  confirm: string;
};

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const sp = useSearchParams();
  const { setUser } = useAuthStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'none' | 'valid' | 'invalid'>(
    'none',
  );
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoEnabled, setPromoEnabled] = useState(false);

  const handleApplyPromo = async (code?: string) => {
    const currentCode = (code ?? promoCode).trim();
    if (!currentCode) return;

    try {
      setPromoLoading(true);
      const res = await validateReferralCode(currentCode);

      if (res.valid) {
        setPromoStatus('valid');
        setPromoCode(currentCode);
        Cookies.set('referralCode', currentCode, { path: '/' });
      } else {
        setPromoStatus('invalid');
      }
    } catch {
      setPromoStatus('invalid');
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    const codeFromCookie = Cookies.get('referralCode');
    if (!codeFromCookie) return;

    setPromoCode(codeFromCookie);
    setPromoStatus('none');
    setPromoEnabled(true);

    setTimeout(() => handleApplyPromo(codeFromCookie), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<FormValues>({
    initialValues: {
      email: '',
      name: '',
      password: '',
      confirm: '',
    },
    validate: {
      email: (v) =>
        /^\S+@\S+\.\S+$/.test(v) ? null : 'Введите корректный email',
      name: (v) => (v.length <= 100 ? null : 'Максимум 100 символов'),
      password: (v) => (v.length >= 6 ? null : 'Минимум 6 символов'),
      confirm: (v, values) =>
        v === values.password ? null : 'Пароли не совпадают',
    },
    validateInputOnBlur: true,
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await apiRegister({
        email: values.email.trim(),
        password: values.password,
        name: values.name.trim() || null,
        referralCode: promoStatus === 'valid' ? promoCode : undefined,
      });
      // После регистрации — логинимся, чтобы получить HttpOnly cookie
      await apiLogin(values.email, values.password);
      const { user } = await apiMe();
      setUser(user);
      const next = process.env.NEXT_PUBLIC_STUB_MODE === 'true'
        ? Paths.DASHBOARD
        : sp.get('next') || Paths.DASHBOARD;
      router.replace(next);
      router.refresh();
    } catch (e: unknown) {
      const errMsg = getErrorMessage(e);
      if (errMsg === 'email_taken') {
        setError('Пользователь с таким email уже зарегистрирован');
      } else {
        setError(getErrorMessage(e) ?? 'Ошибка регистрации');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      <Stack gap="md">
        <Title order={3} ta="center">
          Регистрация
        </Title>
        {error && <Alert color="red">{error}</Alert>}

        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              placeholder="you@example.com"
              withAsterisk
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Имя"
              placeholder="Как к вам обращаться"
              {...form.getInputProps('name')}
            />
            <PasswordInput
              label="Пароль"
              placeholder="Минимум 6 символов"
              withAsterisk
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Повторите пароль"
              withAsterisk
              {...form.getInputProps('confirm')}
            />

            <Stack gap={8} mt="xs">
              <Checkbox
                label="У меня есть промокод"
                checked={promoEnabled}
                onChange={(e) => setPromoEnabled(e.currentTarget.checked)}
              />

              {promoEnabled && (
                <>
                  <Group align="flex-end">
                    <TextInput
                      label="Промокод"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        setPromoStatus('none');
                      }}
                      placeholder="Введите промокод"
                      style={{ flex: 1 }}
                    />
                    <Button
                      onClick={() => handleApplyPromo()}
                      loading={promoLoading}
                      disabled={!promoCode.trim()}
                    >
                      Применить
                    </Button>
                  </Group>

                  {promoStatus === 'valid' && (
                    <Text c="green" fw={500}>
                      <IconCircleCheckFilled size={14} color="green" /> Успешно!
                      Нажмите «Создать аккаунт».
                    </Text>
                  )}

                  {promoStatus === 'invalid' && (
                    <Text c="red">Промокод недействителен</Text>
                  )}
                </>
              )}
            </Stack>

            <Button
              type="submit"
              loading={submitting}
              disabled={!form.isValid()}
            >
              Создать аккаунт
            </Button>
          </Stack>
        </form>

        <Group justify="center" gap="xs">
          <span>Уже есть аккаунт?</span>
          <Anchor href={Paths.LOGIN}>Войти</Anchor>
        </Group>
      </Stack>
    </Paper>
  );
};
