'use client';

import { useEffect, useMemo } from 'react';
import { Card, Title, Text, Stack, Skeleton } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { dayjs } from '@/shared/lib/dates/dayjs';
import { useTestBenchStore } from '@/entities/admin/model/use-testbench-store';
import type { TestBenchRun } from '@/entities/admin/api/admin-api';

const ENGINE_COLORS: Record<'yandex' | 'google', string> = {
  yandex: 'red.6',
  google: 'blue.6',
};

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}м ${s}с`;
}

export function AdminTestBenchPanel() {
  const { runs, loading, error, fetch } = useTestBenchStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const rows = useMemo(() => {
    if (!runs) return [];
    // группируем по времени старта (каждая пара yandex+google)
    const groups = new Map<
      string,
      Partial<Record<'yandex' | 'google', TestBenchRun>>
    >();

    for (const r of runs) {
      // const key = dayjs(r.startedAt).format('YYYY-MM-DD HH:mm');
      const key = dayjs(r.startedAt)
        .startOf('minute')
        .set('minute', Math.floor(dayjs(r.startedAt).minute() / 10) * 10)
        .format('YYYY-MM-DD HH:mm');
      const g = groups.get(key) ?? {};
      g[r.engine] = r;
      groups.set(key, g);
    }

    return Array.from(groups.entries()).map(([key, val]) => ({
      key,
      label: key,
      yandex: val.yandex?.durationMs ? Number(val.yandex.durationMs) : null,
      google: val.google?.durationMs ? Number(val.google.durationMs) : null,
      yandexSpm: val.yandex?.pagesPerMinute ?? null,
      googleSpm: val.google?.pagesPerMinute ?? null,
    }));
  }, [runs]);

  if (loading && !runs) return <Skeleton h={300} mt="md" radius="md" />;
  if (error) return <Text c="red">{error}</Text>;

  return (
    <Card withBorder mt="md">
      <Title order={5} mb="sm">
        Замеры скорости тест-бенча (последние 30 дней)
      </Title>

      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          Нет данных
        </Text>
      ) : (
        <BarChart
          h={300}
          data={rows.map((r) => ({
            bucket: r.label,
            yandex: r.yandex ? r.yandex / 1000 / 60 : 0, // минуты
            google: r.google ? r.google / 1000 / 60 : 0,
            __meta: r,
          }))}
          dataKey="bucket"
          series={[
            { name: 'yandex', color: ENGINE_COLORS.yandex },
            { name: 'google', color: ENGINE_COLORS.google },
          ]}
          // barCategoryGap="30%"
          withLegend
          tooltipProps={{
            content: ({ label, payload }) => {
              const p = payload?.[0]?.payload as {
                __meta?: {
                  yandex?: number | null;
                  google?: number | null;
                  yandexSpm?: number | null;
                  googleSpm?: number | null;
                };
              };
              if (!p?.__meta) return null;
              const { __meta } = p;
              const rows: React.ReactNode[] = [];

              (['yandex', 'google'] as const).forEach((eng) => {
                const dur = __meta[eng];
                const spm = __meta[`${eng}Spm`];
                if (dur == null) return;
                const formatted = formatDuration(dur);
                const pagesPerHour = spm ? spm * 60 : null;
                rows.push(
                  <Stack key={eng} gap={2}>
                    <Text
                      fw={500}
                      c={ENGINE_COLORS[eng]}
                      style={{ textShadow: 'black 1px 0 1px' }}
                    >
                      {eng.toUpperCase()}
                    </Text>
                    <Text size="sm" style={{ textShadow: 'black 1px 0 1px' }}>
                      Время сбора: {formatted}
                    </Text>
                    {pagesPerHour != null && (
                      <Text
                        size="sm"
                        c="dimmed"
                        style={{ textShadow: 'black 1px 0 1px' }}
                      >
                        Потенциал: {pagesPerHour.toFixed(0)} стр/час
                      </Text>
                    )}
                    {spm != null && (
                      <Text
                        size="sm"
                        c="dimmed"
                        style={{ textShadow: 'black 1px 0 1px' }}
                      >
                        Скорость: {spm.toFixed(2)} стр/мин
                      </Text>
                    )}
                  </Stack>
                );
              });

              return (
                <Stack p="xs" gap={4}>
                  <Text fw={600}>{label}</Text>
                  {rows}
                </Stack>
              );
            },
          }}
          yAxisProps={{
            tickFormatter: (v: number) => `${v.toFixed(1)} мин`,
            tickLine: false,
            axisLine: false,
          }}
          xAxisProps={{ tickLine: false, axisLine: false }}
          gridAxis="y"
        />
      )}
    </Card>
  );
}
