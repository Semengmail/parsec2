'use client';

import { Table, Text, ScrollArea } from '@mantine/core';
import { useSelectorStore } from '@/entities/admin/model/use-selector-store';
import { dayjs } from '@/shared/lib/dates/dayjs';

function boolToLabel(v: boolean | null): string {
  if (v === null) return '—';
  return v ? 'OK' : 'FAIL';
}

export function SelectorRunsTable() {
  const { runs } = useSelectorStore();

  if (!runs || runs.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Пока нет запусков селектор-теста
      </Text>
    );
  }

  return (
    <ScrollArea h={300} type="auto">
      <Table striped highlightOnHover mt="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Запуск</Table.Th>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Yandex (no-results)</Table.Th>
            <Table.Th>Yandex (has-results)</Table.Th>
            <Table.Th>Google (no-results)</Table.Th>
            <Table.Th>Google (has-results)</Table.Th>
            <Table.Th>Статус</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {runs.map((r) => {
            const ok =
              r.yandexNoResOk &&
              r.yandexHasResOk &&
              r.googleNoResOk &&
              r.googleHasResOk;
            return (
              <Table.Tr key={r.id}>
                <Table.Td>#{r.id}</Table.Td>
                <Table.Td>
                  {dayjs(r.startedAt).format('DD.MM.YYYY HH:mm')}
                </Table.Td>
                <Table.Td>{boolToLabel(r.yandexNoResOk)}</Table.Td>
                <Table.Td>{boolToLabel(r.yandexHasResOk)}</Table.Td>
                <Table.Td>{boolToLabel(r.googleNoResOk)}</Table.Td>
                <Table.Td>{boolToLabel(r.googleHasResOk)}</Table.Td>
                <Table.Td>{ok ? 'OK' : 'FAIL'}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
