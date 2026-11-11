'use client';

import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useSelectorStore } from '@/entities/admin/model/use-selector-store';

export function SelectorQuality() {
  const { runs } = useSelectorStore();

  if (!runs || runs.length === 0) return null;

  const last = runs[0];
  const ok =
    last.yandexNoResOk &&
    last.yandexHasResOk &&
    last.googleNoResOk &&
    last.googleHasResOk;

  return (
    <Card withBorder padding="xs" radius="md">
      <Group gap="sm">
        <ThemeIcon radius="xl" color={ok ? 'green' : 'red'} variant="light">
          {ok ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
        </ThemeIcon>
        <div>
          <Text fw={600} size="sm">
            Текущий статус селекторов: {ok ? 'OK' : 'Есть проблемы'}
          </Text>
          <Text size="xs" c="dimmed">
            Последний запуск: #{last.id}
          </Text>
        </div>
      </Group>
    </Card>
  );
}
