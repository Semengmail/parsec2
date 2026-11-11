"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Card,
  Title,
  Text,
  Group,
  Stack,
  Select,
  SegmentedControl,
  Skeleton,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import isEqual from "lodash-es/isEqual";

import { useTaskStatsStore } from "@/entities/admin/model/use-task-stats-store";
import type { AggregatedRow as ApiRow } from "@/entities/admin/api/admin-api";
import { dayjs } from "@/shared/lib/dates/dayjs";

type ChartPeriod = "hour" | "day" | "week" | "month";

const PERIOD_OPTIONS: { label: string; value: ChartPeriod }[] = [
  { label: "Часы", value: "hour" },
  { label: "Дни", value: "day" },
  { label: "Недели", value: "week" },
  { label: "Месяцы", value: "month" },
];

const ENGINE_COLORS: Record<string, string> = {
  yandexlive: "red.6",
  googlelive: "blue.6",
};

function isPeriod(v: string): v is ChartPeriod {
  return v === "hour" || v === "day" || v === "week" || v === "month";
}

type Bucket = { key: string; label: string };

type ChartRow = {
  bucket: string;
  bucketStart: string;
  totalPages: number;
  totalAvgSec: number;
  totalPagesPerMinute: number;
  enginesPages: Record<string, number>;
  enginesAvg: Record<string, number>;
  enginesSpeed: Record<string, number>;
  rawLabel: string;
};

type TaskStatsChartProps = {
  rows: ChartRow[];
  period: ChartPeriod;
  engine?: string;
  server?: string;
  activeEngines: string[];
  latestSpeed: {
    yandex: number | null;
    google: number | null;
  } | null;
};

const TaskStatsChart = memo(function TaskStatsChart({
  rows,
  period,
  engine,
  server,
  activeEngines,
  latestSpeed,
}: TaskStatsChartProps) {
  return (
    <BarChart
      key={`${period}-${engine ?? "all"}-${server ?? "all"}`}
      h={260}
      data={rows.map((r) => ({
        bucket: r.bucket,
        ...Object.fromEntries(activeEngines.map((e) => [e, r.enginesPages[e]])),
        __speed: r.enginesSpeed,
        __pages: r.enginesPages,
      }))}
      dataKey="bucket"
      series={activeEngines.map((e) => ({
        name: e,
        color: ENGINE_COLORS[e] ?? "gray.6",
      }))}
      withLegend
      type="stacked"
      tooltipProps={{
        wrapperStyle: { pointerEvents: "auto" },
        contentStyle: { transition: "none" },
        content: ({ label, payload }) => {
          const first = payload?.[0]?.payload as
            | {
                __speed: Record<string, number>;
                __pages: Record<string, number>;
              }
            | undefined;
          return (
            <Stack p="xs" gap={4}>
              <Text fw={600}>{label}</Text>
              {activeEngines.map((eng) => {
                const pages = first?.__pages?.[eng] ?? 0;
                const speed = first?.__speed?.[eng] ?? 0;
                const maxSpeed = eng.includes("yandex")
                  ? (latestSpeed?.yandex ?? null)
                  : (latestSpeed?.google ?? null);
                const periodMinutes = getMinutesForPeriod(period);
                const potentialPages = maxSpeed
                  ? maxSpeed * periodMinutes
                  : null;
                const unusedPages =
                  potentialPages && pages < potentialPages
                    ? potentialPages - pages
                    : 0;
                const unusedPct =
                  potentialPages && pages < potentialPages
                    ? ((unusedPages / potentialPages) * 100).toFixed(1)
                    : "0";

                return (
                  <Stack key={eng} gap={2}>
                    <Group gap={4}>
                      <Text size="sm" c="dimmed" w={100}>
                        {eng}:
                      </Text>
                      <Text size="sm">
                        {pages} стр (скорость {speed.toFixed(1)} стр/мин)
                      </Text>
                    </Group>
                    {potentialPages && (
                      <Text size="xs" c="dimmed">
                        Неиспользовано: {unusedPages.toFixed(0)} стр (
                        {unusedPct}
                        %)
                      </Text>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          );
        },
      }}
      yAxisProps={{ tickLine: false, axisLine: false }}
      gridAxis="y"
    />
  );
});

/** Генерация бакетов времени */
function makeBuckets(period: ChartPeriod, raw: ApiRow[]): Bucket[] {
  const maxDate =
    raw.length > 0
      ? (dayjs.max(raw.map((r) => dayjs(r.periodStart))) ?? dayjs())
      : dayjs();

  const base = maxDate.utc().startOf(period === "hour" ? "hour" : period);

  const buckets: Bucket[] = [];

  const fmt = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: period === "hour" ? "2-digit" : undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const count =
    period === "hour" ? 24 : period === "day" ? 7 : period === "week" ? 8 : 12;

  for (let i = count - 1; i >= 0; i--) {
    const d = base.clone().subtract(i, period);
    buckets.push({
      key: d.toISOString(),
      label: fmt.format(d.toDate()),
    });
  }

  return buckets;
}

function getMinutesForPeriod(period: ChartPeriod): number {
  switch (period) {
    case "hour":
      return 60; // 1 час
    case "day":
      return 60 * 24; // 24 ч
    case "week":
      return 60 * 24 * 7; // 7 дней
    case "month":
      return 60 * 24 * 30; // усреднённый месяц
    default:
      return 60;
  }
}

/** Построение рядов для графика */
function buildChartRows(
  raw: ApiRow[],
  period: ChartPeriod,
  engines: string[],
): ChartRow[] {
  const buckets = makeBuckets(period, raw);
  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  const rows: ChartRow[] = buckets.map((b) => ({
    bucket: b.label,
    bucketStart: b.key,
    totalPages: 0,
    totalAvgSec: 0,
    totalPagesPerMinute: 0,
    enginesPages: Object.fromEntries(engines.map((e) => [e, 0])),
    enginesAvg: Object.fromEntries(engines.map((e) => [e, 0])),
    enginesSpeed: Object.fromEntries(engines.map((e) => [e, 0])),
    rawLabel: b.label,
  }));

  const avgAcc = buckets.map(() => ({ sum: 0, count: 0 }));

  for (const row of raw) {
    const key = dayjs(row.periodStart).utc().startOf(period).toISOString();

    const idx = indexByKey.get(key);
    if (idx == null) continue;
    const target = rows[idx];

    target.totalPages += row.totalPages;
    avgAcc[idx].sum += row.avgDurationSec;
    avgAcc[idx].count += 1;

    if (engines.includes(row.searchEngine)) {
      target.enginesPages[row.searchEngine] += row.totalPages;

      const prevAvg = target.enginesAvg[row.searchEngine];
      target.enginesAvg[row.searchEngine] =
        prevAvg === 0 ? row.avgDurationSec : (prevAvg + row.avgDurationSec) / 2;
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const a = avgAcc[i];
    rows[i].totalAvgSec = a.count ? a.sum / a.count : 0;
    const minutes = getBucketMinutes(rows[i].bucketStart, period);
    rows[i].totalPagesPerMinute =
      minutes > 0 ? rows[i].totalPages / minutes : 0;

    for (const eng of engines) {
      rows[i].enginesSpeed[eng] =
        minutes > 0 ? rows[i].enginesPages[eng] / minutes : 0;
    }
  }

  return rows;
}

function getBucketMinutes(bucketStart: string, period: ChartPeriod): number {
  const fullMinutes = getMinutesForPeriod(period);
  const start = dayjs(bucketStart);
  const end = start.add(1, period);
  const now = dayjs();

  if (now.isBefore(start)) return 0;
  if (now.isAfter(end)) return fullMinutes;

  return Math.max(1, Math.min(fullMinutes, now.diff(start, "minute", true)));
}

export function AdminTaskStatsPanel() {
  const {
    period,
    engine,
    server,
    data,
    servers,
    engines,
    loading,
    error,
    latestSpeed,
    setPeriod,
    setEngine,
    setServer,
    startPolling,
    stopPolling,
    fetchLatestSpeed,
  } = useTaskStatsStore();

  useEffect(() => {
    fetchLatestSpeed();
  }, [fetchLatestSpeed]);

  useEffect(() => {
    startPolling(period === "hour" ? 5000 : 15000);
    return () => stopPolling();
  }, [period, startPolling, stopPolling]);

  const activeEngines = useMemo(
    () => (engine ? [engine] : engines),
    [engine, engines],
  );

  const [stableRows, setStableRows] = useState<ChartRow[]>([]);

  useEffect(() => {
    const next = buildChartRows(data ?? [], period, activeEngines);

    setStableRows((prev) => (isEqual(prev, next) ? prev : next));
  }, [data, period, activeEngines]);

  return (
    <Card withBorder mt="md" style={{ minHeight: 337 }}>
      <Group justify="space-between" align="center" mb="sm" wrap="wrap">
        <Title order={5}>Статистика скорости</Title>

        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            value={period}
            onChange={(v) => {
              if (isPeriod(v)) setPeriod(v);
            }}
            data={PERIOD_OPTIONS}
            size="xs"
          />

          <Select
            placeholder="Поисковик: все"
            value={engine ?? null}
            onChange={(v) => setEngine(v ?? undefined)}
            data={[
              { label: "Все", value: "" },
              ...engines.map((e) => ({ label: e, value: e })),
            ]}
            searchable
            clearable
            size="xs"
            w={180}
          />

          <Select
            placeholder="Сервер: все"
            value={server ?? null}
            onChange={(v) => setServer(v ?? undefined)}
            data={[
              { label: "Все", value: "" },
              ...servers.map((s) => ({ label: s, value: s })),
            ]}
            searchable
            clearable
            size="xs"
            w={180}
          />
        </Group>
      </Group>

      {loading && stableRows.length === 0 && <Skeleton h={260} radius="md" />}

      {error && (
        <Text size="sm" c="red" mb="xs">
          Ошибка: {error}
        </Text>
      )}

      {stableRows.length > 0 && (
        <TaskStatsChart
          rows={stableRows}
          period={period}
          engine={engine}
          server={server}
          activeEngines={activeEngines}
          latestSpeed={latestSpeed}
        />
      )}
    </Card>
  );
}
