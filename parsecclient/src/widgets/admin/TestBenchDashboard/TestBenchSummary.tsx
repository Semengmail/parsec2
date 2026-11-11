'use client';

import { useEffect, useMemo } from 'react';
import { Card, Title, Text, Group, Badge, Stack } from '@mantine/core';
import { useTestBenchChecksStore } from '@/entities/admin/model/use-testbench-checks-store';
import {
  useTestBenchPositionsStore,
  type Engine,
} from '@/entities/admin/model/use-testbench-positions-store';
import {
  TestBenchEngineConfig,
  useTestBenchConfigStore,
} from '@/entities/admin/model/use-testbench-config-store';
import { dayjs } from '@/shared/lib/dates/dayjs';

const ENGINES: Engine[] = ['yandex', 'google'];
const SELECTOR_CONFIRMATION_WINDOW_HOURS = 3;

type BadgeState = 'ok' | 'warn' | 'fail' | 'none';

function hasRecentSelectorFailure(
  checks: NonNullable<ReturnType<typeof useTestBenchChecksStore.getState>['checks']>,
  engine: Engine,
  before: string
) {
  const beforeTs = dayjs(before);
  const since = beforeTs.subtract(SELECTOR_CONFIRMATION_WINDOW_HOURS, 'hour');

  return checks.some((c) => {
    const ts = dayjs(c.createdAt);
    return (
      c.engine === engine &&
      c.type === 'selectors_url_selector_bad' &&
      c.ok === false &&
      ts.isBefore(beforeTs) &&
      (ts.isAfter(since) || ts.isSame(since))
    );
  });
}

export function SummaryPanel() {
  const { checks } = useTestBenchChecksStore();
  const { rowsAll, rows, fetchAll } = useTestBenchPositionsStore();
  const { configs, fetch: fetchConfig } = useTestBenchConfigStore();

  // Загружаем данные
  useEffect(() => {
    void fetchAll(5);
    void fetchConfig();
  }, [fetchAll, fetchConfig]);

  // Последний чек
  const lastTs = checks?.[0]?.createdAt ?? null;

  // Конфиг по двигателю
  const cfg = useMemo(() => {
    const map: Record<Engine, TestBenchEngineConfig | null> = {
      yandex: null,
      google: null,
    };
    if (!configs) return map;
    for (const c of configs) map[c.engine] = c;
    return map;
  }, [configs]);

  // ---------- Проверки ----------
  const hasResults: Record<Engine, BadgeState> = {
    yandex: 'none',
    google: 'none',
  };
  const selectorsState: Record<Engine, BadgeState> = {
    yandex: 'none',
    google: 'none',
  };
  const jumps: Record<Engine, number> = { yandex: 0, google: 0 };
  const dropped: Record<Engine, number> = { yandex: 0, google: 0 };

  if (checks) {
    for (const eng of ENGINES) {
      const c = cfg[eng];
      const engineChecks = checks.filter((x) => x.engine === eng);

      // has results (selectors_has_results)
      const has = engineChecks.find((x) => x.type === 'selectors_has_results');
      hasResults[eng] = has ? (has.ok ? 'ok' : 'fail') : 'none';

      // selector ok → учитываем cfg.autoblockSelectors
      const urlSel = engineChecks.find(
        (x) => x.type === 'selectors_url_selector_bad'
      );
      const noRes = engineChecks.find((x) => x.type === 'selectors_no_results');

      if (!c?.autoblockSelectors) {
        selectorsState[eng] = 'ok';
      } else if (!urlSel || !noRes) {
        selectorsState[eng] = 'none';
      } else if (urlSel.ok && noRes.ok) {
        selectorsState[eng] = 'ok';
      } else if (
        urlSel.ok === false &&
        !hasRecentSelectorFailure(checks, eng, urlSel.createdAt)
      ) {
        selectorsState[eng] = 'warn';
      } else {
        selectorsState[eng] = 'fail';
      }

      // jumps — с учётом порога cfg.positionJumpDiffWarning
      const jumpChecks = engineChecks.filter((x) => x.type === 'position_jump');

      jumps[eng] = jumpChecks.length;
    }
  }

  // dropped — число пропущенных, сравниваем с cfg.maxMissingPositionsPerRun
  const sourceRows = rowsAll ?? rows ?? null;

  if (sourceRows) {
    for (const eng of ENGINES) {
      const c = cfg[eng];
      if (!c) continue;

      const rowsByEngine = sourceRows.filter((r) => r.engine === eng);
      if (rowsByEngine.length === 0) continue;

      const latestTs = [
        ...new Set(rowsByEngine.map((r) => r.collectedAt)),
      ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      const latestPositions = rowsByEngine.filter(
        (r) => r.collectedAt === latestTs
      );

      dropped[eng] = latestPositions.filter((r) => r.position === null).length;
    }
  }

  const BADGE_WIDTH = 160;
  const badge = (state: BadgeState, lbl: string) => (
    <Badge
      color={
        state === 'ok'
          ? 'green'
          : state === 'warn'
            ? 'yellow'
            : state === 'fail'
              ? 'red'
              : 'gray'
      }
      radius="sm"
      variant="filled"
      size="md"
      style={{ width: BADGE_WIDTH, textAlign: 'center' }}
    >
      {lbl}: {state === 'warn' ? 'ПРОВЕРКА' : state === 'none' ? 'Н/Д' : state === 'ok' ? 'OK' : 'FAIL'}
    </Badge>
  );

  const badgeLimit = (value: number, limit: number, label: string) => (
    <Badge
      color={value > limit ? 'red' : 'green'}
      radius="sm"
      variant="filled"
      size="md"
      style={{ width: BADGE_WIDTH, textAlign: 'center' }}
    >
      {label}: {value} / {limit}
    </Badge>
  );

  return (
    <Card withBorder shadow="sm" radius="md" p="lg" mb="lg">
      <Stack gap="sm">
        <Title order={4}>Сводка тест-бенча</Title>

        <Text size="sm" c="dimmed">
          Последний прогон:{' '}
          {lastTs ? <b>{dayjs(lastTs).format('DD.MM.YYYY HH:mm')}</b> : '—'}
        </Text>

        {/* Выдача */}
        <Group>
          <Text fw={600} w={160}>
            Выдача:
          </Text>
          {ENGINES.map((eng) => badge(hasResults[eng], eng.toUpperCase()))}
        </Group>

        {/* Селекторы */}
        <Group>
          <Text fw={600} w={160}>
            Селекторы:
          </Text>
          {ENGINES.map((eng) => badge(selectorsState[eng], eng.toUpperCase()))}
        </Group>

        {/* Пропало из ТОП-30 */}
        <Group>
          <Text fw={600} w={160}>
            Пропусков позиций:
          </Text>
          {ENGINES.map((eng) =>
            badgeLimit(
              dropped[eng],
              cfg[eng]?.maxMissingPositionsPerRun ?? 0,
              eng.toUpperCase()
            )
          )}
        </Group>

        {/* Скачки */}
        <Group>
          <Text fw={600} w={160}>
            Резкие скачки:
          </Text>
          {ENGINES.map((eng) => badgeLimit(jumps[eng], 0, eng.toUpperCase()))}
        </Group>
      </Stack>
    </Card>
  );
}
