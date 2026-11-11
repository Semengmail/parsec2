'use client';

import { useMemo } from 'react';
import { Card, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { useTestBenchPositionsStore } from '@/entities/admin/model/use-testbench-positions-store';
import { dayjs } from '@/shared/lib/dates/dayjs';

const MAX_POSITION = 30; // максимальный собранный топ

export function PositionsSummaryChart() {
  const { summary, engine } = useTestBenchPositionsStore();

  const data = useMemo(() => {
    if (!summary) return [];

    const sorted = [...summary].sort(
      (a, b) => dayjs(a.ts).valueOf() - dayjs(b.ts).valueOf()
    );

    return sorted.map((r) => {
      const avg = r.avgPosition ?? MAX_POSITION;

      return {
        tsIso: r.ts,
        tsLabel: dayjs(r.ts).format('DD.MM HH:mm'),

        avgPosition: avg,
        // преобразуем в “высоту столбца”
        barValue: MAX_POSITION - avg,

        checksCount: r.samples,
        missingCount: r.missing,
      };
    });
  }, [summary]);

  if (!summary || summary.length === 0) {
    return (
      <Card withBorder radius="md" padding="sm">
        <Text size="sm" c="dimmed">
          Нет данных по позициям
        </Text>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" padding="sm">
      <Text size="sm" fw={600} mb="xs">
        Средняя позиция ({engine})
      </Text>

      <BarChart
        h={240}
        data={data}
        dataKey="tsLabel"
        series={[{ name: 'barValue', color: 'blue.6' }]}
        // ось Y обычная, НЕ reversed
        yAxisProps={{
          tickFormatter: (v: number) => {
            const pos = MAX_POSITION - v;
            return `#${pos.toFixed(1)}`;
          },
        }}
        xAxisProps={{
          tickLine: false,
          axisLine: false,
        }}
        gridAxis="y"
        tooltipProps={{
          content: ({ payload }) => {
            const p = payload?.[0]?.payload as
              | {
                  tsIso: string;
                  avgPosition: number;
                  checksCount: number;
                  missingCount: number;
                }
              | undefined;

            if (!p) return null;

            return (
              <Card padding="xs" radius="sm">
                <Text fw={600}>{dayjs(p.tsIso).format('DD.MM HH:mm')}</Text>

                <Text size="sm">
                  Средняя позиция: #{p.avgPosition.toFixed(2)}
                </Text>

                <Text size="xs" c="dimmed">
                  Кол-во проверок: {p.checksCount}
                </Text>

                <Text size="xs" c="dimmed">
                  Не найдено: {p.missingCount}
                </Text>
              </Card>
            );
          },
        }}
      />
    </Card>
  );
}
