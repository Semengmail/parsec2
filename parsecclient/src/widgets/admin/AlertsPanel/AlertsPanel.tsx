'use client';

import { useEffect, useMemo } from 'react';
import {
  Card,
  Title,
  Group,
  SegmentedControl,
  Select,
  Table,
  Tooltip,
  Box,
  Text,
  Badge,
} from '@mantine/core';
import { useTestBenchChecksStore } from '@/entities/admin/model/use-testbench-checks-store';
import { dayjs } from '@/shared/lib/dates/dayjs';

const SELECTOR_CONFIRMATION_WINDOW_HOURS = 3;

export function AlertsPanel() {
  const { checks, engine, days, setEngine, setDays, fetch, loading, error } =
    useTestBenchChecksStore();

  useEffect(() => {
    void fetch();
  }, [engine, days, fetch]);

  /**
   * Тут формируем:
   * - единый список прогонов (bucket по минуте)
   * - строки с тестами
   * - матрицу статусов
   */
  const { buckets, rows } = useMemo(() => {
    if (!checks) return { buckets: [], rows: [] };

    // === 1) ГРУППИРОВКА ПО 15-МИНУТНЫМ СЛОТАМ ===

    const bucketMap = new Map<string, typeof checks>();

    for (const c of checks) {
      const created = dayjs(c.createdAt);

      // округление вниз: 0–14 → 0, 15–29 → 15, 30–44 → 30, 45–59 → 45
      const slotMinutes = Math.floor(created.minute() / 15) * 15;

      const bucket = created
        .startOf('hour')
        .add(slotMinutes, 'minute')
        .toISOString();

      const list = bucketMap.get(bucket) ?? [];
      list.push(c);
      bucketMap.set(bucket, list);
    }

    // сортировка: новые слева
    const buckets = Array.from(bucketMap.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    // === 2) Описание тестов ===
    const tests = [
      {
        id: 'yandex:url',
        label: 'Yandex: URL селектор',
        types: ['selectors_url_selector_bad'],
        engine: 'yandex',
      },
      {
        id: 'yandex:has',
        label: 'Yandex: Есть результаты',
        types: ['selectors_has_results'],
        engine: 'yandex',
      },
      {
        id: 'yandex:no',
        label: 'Yandex: Пустая выдача',
        types: ['selectors_no_results'],
        engine: 'yandex',
      },

      {
        id: 'google:url',
        label: 'Google: URL селектор',
        types: ['selectors_url_selector_bad'],
        engine: 'google',
      },
      {
        id: 'google:has',
        label: 'Google: Есть результаты',
        types: ['selectors_has_results'],
        engine: 'google',
      },
      {
        id: 'google:no',
        label: 'Google: Пустая выдача',
        types: ['selectors_no_results'],
        engine: 'google',
      },
    ];

    // === 3) Матрица ===
    const hasRecentSelectorFailure = (
      bucket: string,
      engine: string,
      allChecks: typeof checks
    ) => {
      const before = dayjs(bucket);
      const since = before.subtract(SELECTOR_CONFIRMATION_WINDOW_HOURS, 'hour');

      return allChecks.some((c) => {
        const ts = dayjs(c.createdAt);
        return (
          c.engine === engine &&
          c.type === 'selectors_url_selector_bad' &&
          c.ok === false &&
          ts.isBefore(before) &&
          (ts.isAfter(since) || ts.isSame(since))
        );
      });
    };

    const rows = tests.map((test) => {
      const cells = buckets.map((bucket) => {
        const list = bucketMap.get(bucket)!;

        const check = list.find(
          (c) => c.engine === test.engine && test.types.includes(c.type)
        );

        if (!check) return { status: 'none', check: null };

        const ok = check.ok ?? !check.type.includes('bad');
        if (
          !ok &&
          check.type === 'selectors_url_selector_bad' &&
          !hasRecentSelectorFailure(bucket, test.engine, checks)
        ) {
          return { status: 'warn', check };
        }

        return { status: ok ? 'ok' : 'fail', check };
      });

      return { test, cells };
    });

    return { buckets, rows };
  }, [checks]);

  return (
    <Card>
      <Group justify="space-between" mb="sm">
        <Title order={5}>Алерты тест-бенча</Title>

        <Group gap="xs">
          <SegmentedControl
            size="xs"
            data={[
              { label: 'All', value: 'all' },
              { label: 'Yandex', value: 'yandex' },
              { label: 'Google', value: 'google' },
            ]}
            value={engine}
            onChange={(v) => setEngine(v as 'all' | 'yandex' | 'google')}
          />

          <Select
            size="xs"
            w={120}
            data={[
              { value: '1', label: '1 день' },
              { value: '3', label: '3 дня' },
              { value: '5', label: '5 дней' },
              { value: '10', label: '10 дней' },
            ]}
            value={String(days)}
            onChange={(v) => v && setDays(Number(v))}
          />
        </Group>
      </Group>

      {loading && <Text size="sm">Загрузка…</Text>}
      {error && <Text c="red">{error}</Text>}

      {!checks || checks.length === 0 ? (
        <Text size="sm" c="dimmed">
          Нет данных
        </Text>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: 'var(--mantine-color-body)',
                    zIndex: 5,
                  }}
                >
                  Тест
                </Table.Th>

                {buckets.map((bucket) => (
                  <Table.Th key={bucket}>
                    <Tooltip
                      label={dayjs(bucket).format('DD.MM.YYYY HH:mm:ss')}
                      withArrow
                    >
                      <Text size="xs">
                        {dayjs(bucket).format('DD.MM HH:mm')}
                      </Text>
                    </Tooltip>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.test.id}>
                  <Table.Td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--mantine-color-body)',
                      zIndex: 5,
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                    }}
                  >
                    {row.test.label}
                  </Table.Td>

                  {row.cells.map((cell, idx) => {
                    if (cell.status === 'none') {
                      return (
                        <Tooltip
                          key={idx}
                          withArrow
                          label="Нет отчета по этому тесту в выбранном временном слоте"
                        >
                          <Table.Td style={{ textAlign: 'center' }}>
                            <Text size="xs" c="gray.5">
                              Н/Д
                            </Text>
                          </Table.Td>
                        </Tooltip>
                      );
                    }

                    const color =
                      cell.status === 'ok'
                        ? 'green'
                        : cell.status === 'warn'
                          ? 'yellow'
                          : 'red';

                    return (
                      <Tooltip
                        key={idx}
                        withArrow
                        label={
                          <div>
                            <b>
                              {dayjs(cell.check!.createdAt).format(
                                'DD.MM.YYYY HH:mm:ss'
                              )}
                            </b>
                            <br />
                            Фраза: {cell.check!.phraseText}
                            <br />
                            {cell.check!.message}
                            {cell.status === 'warn' && (
                              <>
                                <br />
                                Первый сбой: ждем повторного прогона перед
                                блокировкой.
                              </>
                            )}
                          </div>
                        }
                      >
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Badge
                            color={color}
                            variant="filled"
                            size="xs"
                            style={{ cursor: 'pointer' }}
                          >
                            {cell.status === 'ok'
                              ? 'OK'
                              : cell.status === 'warn'
                                ? 'CHECK'
                                : 'FAIL'}
                          </Badge>
                        </Table.Td>
                      </Tooltip>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}
    </Card>
  );
}
