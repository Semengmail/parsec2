'use client';

import { useEffect } from 'react';
import {
  Card,
  Title,
  Group,
  SegmentedControl,
  Skeleton,
  Text,
  Stack,
} from '@mantine/core';
import { useTestBenchPositionsStore } from '@/entities/admin/model/use-testbench-positions-store';
import { PositionsSummaryChart } from './PositionsSummaryChart';
import { PositionsTable } from './PositionsTable';

export function PositionsPanel() {
  const { engine, setEngine, fetch, loading, summary, rows, error } =
    useTestBenchPositionsStore();

  useEffect(() => {
    void fetch(5);
  }, [engine, fetch]);

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={5}>Тест позиций (по тестовому сайту)</Title>
        <SegmentedControl
          size="xs"
          data={[
            { label: 'Yandex', value: 'yandex' },
            { label: 'Google', value: 'google' },
          ]}
          value={engine}
          onChange={(val) => setEngine(val as 'yandex' | 'google')}
        />
      </Group>

      {loading && !summary && !rows && <Skeleton h={220} radius="md" />}

      {error && (
        <Text c="red" size="sm" mb="sm">
          {error}
        </Text>
      )}

      <Stack gap="md">
        <PositionsSummaryChart />
        <PositionsTable />
      </Stack>
    </Card>
  );
}
