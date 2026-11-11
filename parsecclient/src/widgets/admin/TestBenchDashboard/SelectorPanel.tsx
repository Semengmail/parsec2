'use client';

import { useEffect } from 'react';
import { Card, Stack, Title, Text } from '@mantine/core';
import { useSelectorStore } from '@/entities/admin/model/use-selector-store';
import { SelectorRunsTable } from './SelectorRunsTable';
import { SelectorQuality } from './SelectorQuality';

export function SelectorPanel() {
  const { fetch, loading, error, runs } = useSelectorStore();

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={5}>Тест селекторов (URL / no-results)</Title>

        {loading && !runs && (
          <Text size="sm" c="dimmed">
            Загрузка...
          </Text>
        )}
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <SelectorQuality />
        <SelectorRunsTable />
      </Stack>
    </Card>
  );
}
