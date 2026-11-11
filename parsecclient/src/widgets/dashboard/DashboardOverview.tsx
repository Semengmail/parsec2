'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Group,
  Stack,
  Title,
  Text,
  Grid,
  Badge,
  TextInput,
  Button,
  ActionIcon,
  Modal,
  Tooltip,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { IconRefresh } from '@tabler/icons-react';

import {
  apiGetDashboardSummary,
  apiRotateMyApiKey,
  type DashboardSummary,
} from '@/features/dashboard/module/api';
import { formatRubHumanThousandths } from '@/shared/utils/money/formatThousandths';
import { copyToClipboard } from '@/shared/utils/clipboard/copyToClipboard';
import { showNotification } from '@/shared/utils/notifications/showNotification';
import { showError } from '@/shared/utils/notifications/showError';

export function DashboardOverview() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotateModalOpened, setRotateModalOpened] = useState(false);
  const [rotating, setRotating] = useState(false);
  const clipboard = useClipboard({ timeout: 1500 });
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGetDashboardSummary();
        if (mounted) setData(res);
      } catch {
        if (mounted) setError('Не удалось загрузить сводку');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <Text c="red">{error}</Text>;
  if (!data) return <Text>Загрузка…</Text>;

  const infoUrl = `${apiBase}/public/info?key=${data.apiKey}`;
  const balanceUrl = `${apiBase}/public/info/balance?key=${data.apiKey}`;

  const { tariff, baseTariff, rates, spend } = data;

  const handleRotateApiKey = async () => {
    setRotating(true);
    try {
      const res = await apiRotateMyApiKey();
      setData((current) =>
        current ? { ...current, apiKey: res.apiKey } : current,
      );
      setRotateModalOpened(false);
      showNotification(
        'Новый API Key сгенерирован. Обновите ключ во всех приложениях, которые используют публичное API.',
        'API Key обновлен',
      );
    } catch {
      showError('Не удалось сгенерировать новый API Key. Попробуйте еще раз.');
    } finally {
      setRotating(false);
    }
  };

  return (
    <Stack gap="md">
      <Title order={3}>Общая сводка</Title>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Title order={5}>Тарифный план</Title>
            {tariff ? (
              <Stack gap={4} mt="sm">
                <Text>
                  Тариф: <b>{tariff.name}</b> ({tariff.code})
                </Text>
                <Text>
                  Баланс тарифа:{' '}
                  <b>{formatRubHumanThousandths(tariff.balance)}</b>
                </Text>
                <Text>
                  Действует до:{' '}
                  <b>
                    {tariff.expiresAt
                      ? new Date(tariff.expiresAt).toLocaleString()
                      : '—'}
                  </b>
                </Text>
              </Stack>
            ) : (
              <Stack gap={4} mt="sm">
                <Text>
                  Активный тариф: <b>нет</b>
                </Text>
                {baseTariff && (
                  <Text>
                    Базовый тариф: <b>{baseTariff.name}</b> ({baseTariff.code})
                  </Text>
                )}
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Title order={5}>Статистика расходов</Title>
            <Stack gap={4} mt="sm">
              <Text>
                За 7 дней: <b>{formatRubHumanThousandths(spend.last7d)}</b>
              </Text>
              <Text>
                За 30 дней: <b>{formatRubHumanThousandths(spend.last30d)}</b>
              </Text>
              <Text>
                Всего: <b>{formatRubHumanThousandths(spend.total)}</b>
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Title order={5}>Лимиты по услугам</Title>
            <Stack gap="xs" mt="sm">
              {rates.length === 0 && (
                <Text c="dimmed">Нет активного тарифа</Text>
              )}
              {rates.map((r) => (
                <Group key={r.service} justify="space-between">
                  <Text>{r.service}</Text>
                  <Group gap="xs">
                    <Badge title="Цена за единицу">
                      {formatRubHumanThousandths(r.unitPrice)}
                    </Badge>
                    <Badge title="Доступно по балансу">
                      {r.availableByMoney}
                    </Badge>
                    {r.limitUnits != null && (
                      <Badge title="Лимит">{r.limitUnits}</Badge>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
      {/* Публичные API-ссылки */}
      <Card withBorder mt="lg">
        <Group gap="xs" ms={10}>
          <Title order={5}>Ваш API Key</Title>
          <Tooltip label="Сгенерировать новый API Key" withArrow>
            <ActionIcon
              aria-label="Сгенерировать новый API Key"
              variant="subtle"
              onClick={() => setRotateModalOpened(true)}
            >
              <IconRefresh size={18} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Stack gap="xs" mt="sm" mb="md">
          <Group wrap="nowrap">
            <TextInput value={data.apiKey} readOnly style={{ flex: 1 }} />
            <Button
              variant="light"
              onClick={async () => {
                const ok = await copyToClipboard(data.apiKey);
                if (ok) {
                  clipboard.copy(data.apiKey);
                }
              }}
            >
              {clipboard.copied ? 'OK' : 'Копировать'}
            </Button>
          </Group>
        </Stack>
        <Title order={5}>Публичные API ссылки</Title>
        <Stack gap="xs" mt="sm">
          <Text fw={500}>Информация о тарифе и лимитах</Text>
          <Group wrap="nowrap">
            <TextInput value={infoUrl} readOnly style={{ flex: 1 }} />
            <Button
              variant="light"
              onClick={async () => {
                const ok = await copyToClipboard(infoUrl);
                if (ok) {
                  clipboard.copy(infoUrl); // для визуального статуса, если хочешь
                }
              }}
            >
              {clipboard.copied ? 'OK' : 'Копировать'}
            </Button>
          </Group>

          <Text fw={500}>Баланс</Text>
          <Group wrap="nowrap">
            <TextInput value={balanceUrl} readOnly style={{ flex: 1 }} />
            <Button
              variant="light"
              onClick={async () => {
                const ok = await copyToClipboard(balanceUrl);
                if (ok) {
                  clipboard.copy(infoUrl); // для визуального статуса, если хочешь
                }
              }}
            >
              {clipboard.copied ? 'OK' : 'Копировать'}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={rotateModalOpened}
        onClose={() => setRotateModalOpened(false)}
        title="Сгенерировать новый API Key?"
        centered
      >
        <Stack gap="md">
          <Text>
            После подтверждения текущий API Key перестанет работать. Все
            приложения, скрипты и интеграции, где он уже используется, потеряют
            доступ к публичному API, пока вы не замените ключ на новый.
          </Text>
          <Text c="dimmed" size="sm">
            Это действие нельзя отменить. Новый ключ появится в кабинете сразу
            после генерации.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setRotateModalOpened(false)}
              disabled={rotating}
            >
              Отмена
            </Button>
            <Button
              color="red"
              onClick={handleRotateApiKey}
              loading={rotating}
            >
              Сгенерировать новый ключ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
