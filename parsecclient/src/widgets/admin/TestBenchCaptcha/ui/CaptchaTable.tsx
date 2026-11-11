import { TestBenchCaptchaMetric } from '@/features/test-bench/api';
import { copyToClipboard } from '@/shared/utils/clipboard/copyToClipboard';
import { showError } from '@/shared/utils/notifications/showError';
import { showNotification } from '@/shared/utils/notifications/showNotification';
import { ActionIcon, Group, Table, Tooltip, Text } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { HistogramTooltip } from './HistogramTooltip';
import { formatMetricDate } from '../utils/formatDate';
import styles from './CaptchaTable.module.css';

interface CaptchaTableProps {
  title: string;
  rows: TestBenchCaptchaMetric[];
  dates: string[];
}

function formatHistogramText(metric: TestBenchCaptchaMetric, title: string) {
  const histogramRows = Object.entries(metric.histogram)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, value]) => `${key}: ${value}`);

  return [
    title,
    `Дата: ${formatMetricDate(metric.collectedAt)}`,
    `Среднее без нулевых: ${metric.avgNonZero.toFixed(2)}`,
    '',
    ...histogramRows,
  ].join('\n');
}

export function CaptchaTable({ title, rows, dates }: CaptchaTableProps) {
  const byDate = new Map<string, TestBenchCaptchaMetric>();
  for (const r of rows) {
    const d = formatMetricDate(r.collectedAt);
    byDate.set(d, r);
  }

  const handleCopyHistogram = async (metric: TestBenchCaptchaMetric) => {
    const ok = await copyToClipboard(formatHistogramText(metric, title));

    if (ok) {
      showNotification('Статистика капч скопирована');
      return;
    }

    showError('Не удалось скопировать статистику капч');
  };

  return (
    <Table withColumnBorders highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{title}</Table.Th>
          {dates.map((d) => (
            <Table.Th key={d}>{d}</Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>

      <Table.Tbody>
        {/* Нулевые капчи */}
        <Table.Tr>
          <Table.Td>Нулевые капчи</Table.Td>
          {dates.map((d) => {
            const r = byDate.get(d);
            return (
              <Table.Td key={d}>
                {r
                  ? `${r.zeroCaptchaCount} / ${r.zeroPercent.toFixed(1)}%`
                  : '-'}
              </Table.Td>
            );
          })}
        </Table.Tr>

        {/* Среднее без нулевых */}
        <Table.Tr>
          <Table.Td>Среднее без нулевых</Table.Td>
          {dates.map((d) => {
            const r = byDate.get(d);
            return (
              <Table.Td key={d} className={r ? styles.statCell : undefined}>
                {r ? (
                  <Group gap={4} wrap="nowrap" justify="flex-end">
                    <Tooltip
                      label={<HistogramTooltip histogram={r.histogram} />}
                      withArrow
                    >
                      <Text span>{r.avgNonZero.toFixed(2)}</Text>
                    </Tooltip>

                    <Tooltip label="Скопировать статистику">
                      <ActionIcon
                        className={styles.copyButton}
                        variant="subtle"
                        color="gray"
                        size="xs"
                        aria-label={`Скопировать статистику ${title} за ${d}`}
                        onClick={() => void handleCopyHistogram(r)}
                      >
                        <IconCopy size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ) : (
                  '-'
                )}
              </Table.Td>
            );
          })}
        </Table.Tr>
      </Table.Tbody>
    </Table>
  );
}
