'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  AdminGlobalSettings,
  apiGetAdminSettings,
  apiUpdateAdminSettings,
} from '@/entities/admin/api/admin-api';
import { showNotification } from '@/shared/utils/notifications/showNotification';
import { showError } from '@/shared/utils/notifications/showError';

const serviceRows = [
  { key: 'googleLive', label: 'Лимит по Google' },
  { key: 'yandexLive', label: 'Лимит по Яндекс' },
  { key: 'yandexXml', label: 'Лимит по Yandex XML' },
  { key: 'frequency', label: 'Лимит по частотности' },
] as const;

type ServiceKey = (typeof serviceRows)[number]['key'];

const MIN_LIMIT = 1;
const MAX_LIMIT = 10_000;

function isValidLimit(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_LIMIT && value <= MAX_LIMIT;
}

function validateSettings(settings: AdminGlobalSettings): string | null {
  if (!isValidLimit(settings.globalMaxInFlight)) {
    return 'Глобальный лимит должен быть целым числом от 1 до 10000';
  }
  if (!isValidLimit(settings.maxQueuedPerEngine)) {
    return 'Лимит очереди должен быть целым числом от 1 до 10000';
  }

  for (const row of serviceRows) {
    const item = settings.services[row.key];
    if (!isValidLimit(item.userRequestLimit)) {
      return `${row.label}: лимит для пользователя должен быть от 1 до 10000`;
    }
    if (!isValidLimit(item.adminRequestLimit)) {
      return `${row.label}: лимит для админа должен быть от 1 до 10000`;
    }
  }

  return null;
}

export function AdminSettingsPanel() {
  const [settings, setSettings] = useState<AdminGlobalSettings | null>(null);
  const [initial, setInitial] = useState<AdminGlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    apiGetAdminSettings()
      .then((data) => {
        if (!alive) return;
        setSettings(data);
        setInitial(data);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const message =
          e instanceof Error ? e.message : 'Не удалось загрузить настройки';
        setError(message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const validationError = useMemo(
    () => (settings ? validateSettings(settings) : null),
    [settings],
  );

  const updateRoot = (
    key: 'globalMaxInFlight' | 'maxQueuedPerEngine',
    value: number | string,
  ) => {
    const next = Number(value);
    setSettings((current) =>
      current
        ? { ...current, [key]: Number.isFinite(next) ? next : 0 }
        : current,
    );
  };

  const updateService = (
    service: ServiceKey,
    field: 'userRequestLimit' | 'adminRequestLimit',
    value: number | string,
  ) => {
    const next = Number(value);
    setSettings((current) =>
      current
        ? {
            ...current,
            services: {
              ...current.services,
              [service]: {
                ...current.services[service],
                [field]: Number.isFinite(next) ? next : 0,
              },
            },
          }
        : current,
    );
  };

  const save = async () => {
    if (!settings) return;

    const message = validateSettings(settings);
    if (message) {
      showError(message, 'Проверьте настройки');
      return;
    }

    try {
      setSaving(true);
      const saved = await apiUpdateAdminSettings(settings);
      setSettings(saved);
      setInitial(saved);
      showNotification('Настройки сохранены');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось сохранить настройки';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (initial) setSettings(initial);
  };

  if (loading) {
    return <Text size="sm">Загрузка…</Text>;
  }

  if (error) {
    return (
      <Text size="sm" c="red">
        Ошибка: {error}
      </Text>
    );
  }

  if (!settings) {
    return <Text size="sm">Настройки не найдены</Text>;
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={4}>Глобальные настройки</Title>
        <Text size="sm" c="dimmed">
          Изменения применяются после сохранения. Серверный кэш настроек
          сбрасывается автоматически.
        </Text>
      </Stack>

      <Group align="flex-end">
        <NumberInput
          label="Глобальный лимит в работе"
          min={MIN_LIMIT}
          max={MAX_LIMIT}
          step={1}
          allowDecimal={false}
          value={settings.globalMaxInFlight}
          onChange={(value) => updateRoot('globalMaxInFlight', value)}
        />
        <NumberInput
          label="Максимум задач в очереди на сервис"
          min={MIN_LIMIT}
          max={MAX_LIMIT}
          step={1}
          allowDecimal={false}
          value={settings.maxQueuedPerEngine}
          onChange={(value) => updateRoot('maxQueuedPerEngine', value)}
        />
      </Group>

      <Stack gap="sm">
        <Title order={5}>Лимиты потоков</Title>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Сервис</Table.Th>
              <Table.Th>Лимит для пользователя</Table.Th>
              <Table.Th>Лимит для админа(toolzar)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {serviceRows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {row.label}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    min={MIN_LIMIT}
                    max={MAX_LIMIT}
                    step={1}
                    allowDecimal={false}
                    value={settings.services[row.key].userRequestLimit}
                    onChange={(value) =>
                      updateService(row.key, 'userRequestLimit', value)
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    min={MIN_LIMIT}
                    max={MAX_LIMIT}
                    step={1}
                    allowDecimal={false}
                    value={settings.services[row.key].adminRequestLimit}
                    onChange={(value) =>
                      updateService(row.key, 'adminRequestLimit', value)
                    }
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>

      {validationError && (
        <Alert color="red" title="Некорректные значения">
          {validationError}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={reset} disabled={saving}>
          Отменить
        </Button>
        <Button
          onClick={save}
          loading={saving}
          disabled={Boolean(validationError)}
        >
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
