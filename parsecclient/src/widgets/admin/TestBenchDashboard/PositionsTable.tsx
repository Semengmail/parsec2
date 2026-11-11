'use client';

import { useMemo } from 'react';
import { Table, Text, Tooltip, Box } from '@mantine/core';
import { useTestBenchPositionsStore } from '@/entities/admin/model/use-testbench-positions-store';
import { dayjs } from '@/shared/lib/dates/dayjs';

const PHRASE_COL_WIDTH = 320;

export function PositionsTable() {
  const { rows } = useTestBenchPositionsStore();

  const { columns, matrix } = useMemo(() => {
    if (!rows) return { phrases: [], columns: [], matrix: [] };

    // Уникальные временные точки
    const allTs = Array.from(new Set(rows.map((r) => r.collectedAt))).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    // Уникальные фразы: берем текст из самой новой записи по phraseId
    const phraseLatest = new Map<
      string,
      { phrase: string; collectedAtMs: number; rowId: number }
    >();
    for (const r of rows) {
      const key = `${r.phraseId}`;
      const collectedAtMs = new Date(r.collectedAt).getTime();
      const prev = phraseLatest.get(key);

      if (
        !prev ||
        collectedAtMs > prev.collectedAtMs ||
        (collectedAtMs === prev.collectedAtMs && r.id > prev.rowId)
      ) {
        phraseLatest.set(key, {
          phrase: r.phraseText,
          collectedAtMs,
          rowId: r.id,
        });
      }
    }

    const phrases = Array.from(phraseLatest.entries()).map(([id, meta]) => ({
      id,
      phrase: meta.phrase,
    }));

    // Матрица: фраза → позиции
    const map = new Map<string, Record<string, number | null | undefined>>();

    for (const r of rows) {
      const key = `${r.phraseId}`;
      const rec = map.get(key) ?? {};
      rec[r.collectedAt] = r.position;
      map.set(key, rec);
    }

    const matrix = phrases.map((p) => ({
      phrase: p.phrase,
      values: allTs.map((ts) => map.get(p.id)?.[ts] ?? null),
    }));

    return { phrases, columns: allTs, matrix };
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Нет сырых данных по позициям
      </Text>
    );
  }

  return (
    <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <Table striped highlightOnHover mt="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th
              style={{
                position: 'sticky',
                left: 0,
                zIndex: 5,
                background: 'var(--mantine-color-body)',
                fontSize: 12,
                width: PHRASE_COL_WIDTH,
                maxWidth: PHRASE_COL_WIDTH,
                whiteSpace: 'nowrap',
              }}
            >
              Фраза
            </Table.Th>

            {columns.map((ts) => {
              const short = dayjs(ts).format('HH:mm');
              const full = dayjs(ts).format('DD.MM.YYYY HH:mm:ss');

              return (
                <Table.Th
                  key={ts}
                  style={{
                    fontSize: 11,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Tooltip label={full} withArrow>
                    <Text size="xs">{short}</Text>
                  </Tooltip>
                </Table.Th>
              );
            })}
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {matrix.map((row, rowIdx) => (
            <Table.Tr key={rowIdx}>
              {/* STICKY колонка фразы */}
              <Table.Td
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 4,
                  background: 'var(--mantine-color-body)',
                  fontSize: 12,
                  width: PHRASE_COL_WIDTH,
                  maxWidth: PHRASE_COL_WIDTH,
                  whiteSpace: 'nowrap',
                }}
              >
                {row.phrase}
              </Table.Td>

              {row.values.map((v, i) => {
                const prev =
                  i < row.values.length - 1 ? row.values[i + 1] : null;

                if (v === null) {
                  return (
                    <Table.Td
                      key={i}
                      style={{
                        textAlign: 'center',
                        fontSize: 12,
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Text c="gray.6">–</Text>
                    </Table.Td>
                  );
                }

                let diff: number | null = null;
                let arrow: React.ReactNode = null;
                let diffColor: string | undefined;

                if (prev !== null) {
                  diff = prev - v;

                  if (diff > 0) {
                    // улучшение
                    arrow = (
                      <Text span c="green.6">
                        ↑
                      </Text>
                    );
                    diffColor = 'green.6';
                  } else if (diff < 0) {
                    // ухудшение
                    arrow = (
                      <Text span c="red.6">
                        ↓
                      </Text>
                    );
                    diffColor = 'red.6';
                  } else {
                    // no change
                    arrow = (
                      <Text span c="gray.5">
                        •
                      </Text>
                    );
                    diffColor = 'gray.5';
                  }
                }

                return (
                  <Table.Td
                    key={i}
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      padding: '2px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Text span>
                      {v}
                      {diff !== null && diff !== 0 && (
                        <>
                          {' '}
                          <Text span c={diffColor}>
                            ({diff > 0 ? `+${diff}` : diff}) {arrow}
                          </Text>
                        </>
                      )}
                    </Text>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
