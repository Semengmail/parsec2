'use client';

import {
  Card,
  Title,
  Group,
  Stack,
  Text,
  Badge,
  Skeleton,
  Table,
  Button,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconRefresh, IconTrash } from '@tabler/icons-react';
import { useEffect } from 'react';
import { dayjs } from '@/shared/lib/dates/dayjs';

import { useThroughputStore } from '@/entities/admin/model/use-throughput-store';
import { ThroughputRecord } from '@/entities/admin/api/admin-api';

/** Подписи периодов (какой рекорд) */
const PERIOD_LABELS: Record<string, string> = {
  day: 'Лучший за сутки',
  week: 'Лучший за неделю',
  month: 'Лучший за месяц',
  all_time: 'Абсолютный рекорд',
};

/** Проекция из пикового часа */
function projectFromHour(pagesPerHour: number) {
  return {
    hour: pagesPerHour,
    h12: pagesPerHour * 12,
    day: pagesPerHour * 24,
    week: pagesPerHour * 24 * 7,
    month: pagesPerHour * 24 * 30,
  };
}

function format(n: number): string {
  return Math.round(n).toLocaleString();
}

export function AdminThroughputPanel() {
  const {
    data,
    loading,
    rebuilding,
    deletingKey,
    error,
    fetch,
    rebuild,
    remove,
  } = useThroughputStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading) {
    return (
      <Card withBorder mt="md">
        <Skeleton h={220} />
      </Card>
    );
  }

  /** группируем: server + searchEngine */
  const grouped = Object.groupBy(data, (r) => `${r.server}::${r.searchEngine}`);

  return (
    <Card withBorder mt="md">
      <Group justify="space-between" mb="sm">
        <Title order={5}>
          Потенциальная производительность по сбору страниц в период
        </Title>

        <Tooltip label="Пересчитать рекорды (пиковые часы)">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={rebuilding}
            onClick={() => rebuild()}
          >
            Rebuild
          </Button>
        </Tooltip>
      </Group>

      <Stack gap="md">
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        {Object.entries(grouped).map(([key, rows]) => {
          if (!rows || rows.length === 0) return null;

          const [server, engine] = key.split('::');
          const isDeleting = deletingKey === key;

          const handleDelete = () => {
            const confirmed = window.confirm(
              `Удалить статистику server ${server} / ${engine}?`,
            );

            if (confirmed) {
              void remove({ server, engine });
            }
          };

          return (
            <Card key={key} withBorder radius="sm" p="sm">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Badge variant="light">server {server}</Badge>
                  <Badge color={engine.includes('yandex') ? 'red' : 'blue'}>
                    {engine}
                  </Badge>
                </Group>

                <Tooltip
                  label={`Удалить статистику ${engine} для server ${server}`}
                >
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    loading={isDeleting}
                    aria-label={`Удалить статистику ${engine} для server ${server}`}
                    onClick={handleDelete}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <Table
                striped
                withColumnBorders
                highlightOnHover
                verticalSpacing="xs"
                horizontalSpacing="sm"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Рекорд</Table.Th>
                    <Table.Th ta="right">В час</Table.Th>
                    <Table.Th ta="right">12 часов</Table.Th>
                    <Table.Th ta="right">Сутки</Table.Th>
                    <Table.Th ta="right">Неделя</Table.Th>
                    <Table.Th ta="right">Месяц</Table.Th>
                    <Table.Th ta="right">Час пика</Table.Th>
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {rows.map((r: ThroughputRecord) => {
                    const pagesPerHour = r.pagesPerSec * 3600;
                    const projected = projectFromHour(pagesPerHour);

                    return (
                      <Table.Tr key={r.period}>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {PERIOD_LABELS[r.period]}
                          </Text>
                        </Table.Td>

                        <Table.Td ta="right">
                          <Tooltip
                            label={`${(r.pagesPerSec * 60).toFixed(1)} стр/мин`}
                          >
                            <Text size="sm" fw={600}>
                              {format(projected.hour)}
                            </Text>
                          </Tooltip>
                        </Table.Td>

                        <Table.Td ta="right">{format(projected.h12)}</Table.Td>

                        <Table.Td ta="right">{format(projected.day)}</Table.Td>

                        <Table.Td ta="right">{format(projected.week)}</Table.Td>

                        <Table.Td ta="right">
                          {format(projected.month)}
                        </Table.Td>

                        <Table.Td ta="right">
                          <Text size="xs" c="dimmed">
                            {dayjs(r.hour).format('DD.MM HH:mm')}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
}
