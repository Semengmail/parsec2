"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Checkbox,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { LineChart } from "@mantine/charts";
import {
  QueueAnalyticsResponse,
  QueueMinuteSample,
  apiGetQueueAnalytics,
} from "@/entities/admin/api/admin-api";

type ViewMode = "realtime" | "hourly" | "daily";

const stateColors: Record<QueueAnalyticsResponse["summary"]["state"], string> =
  {
    idle: "gray",
    normal: "green",
    busy: "yellow",
    overloaded: "red",
  };

const stateLabels: Record<QueueAnalyticsResponse["summary"]["state"], string> =
  {
    idle: "Спокойно",
    normal: "Норма",
    busy: "Высокая нагрузка",
    overloaded: "Перегруз",
  };

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const hourFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
});

function metric(value: number | undefined): string {
  return Math.round(value ?? 0).toLocaleString("ru-RU");
}

function formatWorstEngine(
  value: QueueAnalyticsResponse["summary"]["worstEngine"],
): string {
  if (value === "yandexlive") return "Яндекс Live";
  if (value === "googlelive") return "Google Live";
  if (value === "balanced") return "оба движка";
  return "нет очереди";
}

type RealtimeChartRow = {
  label: string;
  queued: number;
  inFlight: number;
  yandex: number;
  google: number;
  speedTotal: number;
  speedYandex: number;
  speedGoogle: number;
  speedYandexDesktop: number;
  speedYandexMobile: number;
  speedGoogleDesktop: number;
  speedGoogleMobile: number;
};

type SpeedSeriesKey =
  | "speedYandex"
  | "speedGoogle"
  | "speedYandexDesktop"
  | "speedYandexMobile"
  | "speedGoogleDesktop"
  | "speedGoogleMobile";

const speedSeriesOptions: Array<{
  value: SpeedSeriesKey;
  label: string;
  color: string;
}> = [
  { value: "speedYandex", label: "Яндекс", color: "red.7" },
  { value: "speedGoogle", label: "Google", color: "violet.7" },
  { value: "speedYandexDesktop", label: "Яндекс desktop", color: "orange.7" },
  { value: "speedYandexMobile", label: "Яндекс mobile", color: "pink.6" },
  { value: "speedGoogleDesktop", label: "Google desktop", color: "indigo.7" },
  { value: "speedGoogleMobile", label: "Google mobile", color: "grape.6" },
];

function minuteLabel(ts: string): string {
  return timeFmt.format(new Date(ts));
}

function throughput(row: QueueMinuteSample) {
  return (
    row.throughputPagesPerMinute ?? {
      total: 0,
      byEngine: {
        yandexlive: { total: 0, desktop: 0, mobile: 0 },
        googlelive: { total: 0, desktop: 0, mobile: 0 },
      },
    }
  );
}

function maxRealtimeRows(rows: QueueMinuteSample[]): RealtimeChartRow[] {
  const byMinute = new Map<string, RealtimeChartRow>();

  for (const row of rows) {
    const label = minuteLabel(row.ts);
    const prev = byMinute.get(label);
    const speed = throughput(row);
    const next = {
      label,
      queued: row.total.queued,
      inFlight: row.total.inFlight,
      yandex: row.byEngine.yandexlive.queued,
      google: row.byEngine.googlelive.queued,
      speedTotal: speed.total,
      speedYandex: speed.byEngine.yandexlive.total,
      speedGoogle: speed.byEngine.googlelive.total,
      speedYandexDesktop: speed.byEngine.yandexlive.desktop,
      speedYandexMobile: speed.byEngine.yandexlive.mobile,
      speedGoogleDesktop: speed.byEngine.googlelive.desktop,
      speedGoogleMobile: speed.byEngine.googlelive.mobile,
    };

    byMinute.set(
      label,
      prev
        ? {
            label,
            queued: Math.max(prev.queued, next.queued),
            inFlight: Math.max(prev.inFlight, next.inFlight),
            yandex: Math.max(prev.yandex, next.yandex),
            google: Math.max(prev.google, next.google),
            speedTotal: Math.max(prev.speedTotal, next.speedTotal),
            speedYandex: Math.max(prev.speedYandex, next.speedYandex),
            speedGoogle: Math.max(prev.speedGoogle, next.speedGoogle),
            speedYandexDesktop: Math.max(
              prev.speedYandexDesktop,
              next.speedYandexDesktop,
            ),
            speedYandexMobile: Math.max(
              prev.speedYandexMobile,
              next.speedYandexMobile,
            ),
            speedGoogleDesktop: Math.max(
              prev.speedGoogleDesktop,
              next.speedGoogleDesktop,
            ),
            speedGoogleMobile: Math.max(
              prev.speedGoogleMobile,
              next.speedGoogleMobile,
            ),
          }
        : next,
    );
  }

  return [...byMinute.values()];
}

function buildChartRows(data: QueueAnalyticsResponse, mode: ViewMode) {
  if (mode === "realtime") {
    return maxRealtimeRows(data.realtime);
  }

  if (mode === "hourly") {
    return data.hourly.map((row) => ({
      label: hourFmt.format(new Date(row.ts)),
      queued: row.queuedMax,
      inFlight: row.inFlightMax,
      yandex: row.yandexQueuedMax,
      google: row.googleQueuedMax,
      speedTotal: row.throughputPagesMax ?? 0,
      speedYandex: row.yandexThroughputPagesMax ?? 0,
      speedGoogle: row.googleThroughputPagesMax ?? 0,
      speedYandexDesktop: row.yandexDesktopThroughputPagesMax ?? 0,
      speedYandexMobile: row.yandexMobileThroughputPagesMax ?? 0,
      speedGoogleDesktop: row.googleDesktopThroughputPagesMax ?? 0,
      speedGoogleMobile: row.googleMobileThroughputPagesMax ?? 0,
    }));
  }

  return data.daily.map((row) => ({
    label: `${row.weekday} ${row.date.slice(5)}`,
    queued: row.queuedMax,
    inFlight: row.inFlightMax,
    yandex: 0,
    google: 0,
    speedTotal: row.throughputPagesMax ?? 0,
    speedYandex: 0,
    speedGoogle: 0,
    speedYandexDesktop: 0,
    speedYandexMobile: 0,
    speedGoogleDesktop: 0,
    speedGoogleMobile: 0,
  }));
}

export function AdminQueueAnalyticsPanel() {
  const [data, setData] = useState<QueueAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("realtime");
  const [enabledSpeedSeries, setEnabledSpeedSeries] = useState<
    SpeedSeriesKey[]
  >([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const next = await apiGetQueueAnalytics();
        if (!alive) return;
        setData(next);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(
          e instanceof Error ? e.message : "Не удалось загрузить очередь",
        );
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    const id = window.setInterval(load, 60_000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const chartRows = useMemo(
    () => (data ? buildChartRows(data, mode) : []),
    [data, mode],
  );
  const chartSeries = useMemo(() => {
    const base = [
      { name: "inFlight", label: "В работе", color: "blue.6" },
      { name: "queued", label: "Очередь", color: "cyan.6" },
      {
        name: "speedTotal",
        label: "Скорость обработки",
        color: "green.7",
        yAxisId: "right",
      },
    ];

    if (mode === "daily") return base;

    return [
      ...base,
      { name: "yandex", label: "Яндекс очередь", color: "red.6" },
      { name: "google", label: "Google очередь", color: "violet.6" },
      ...speedSeriesOptions
        .filter((item) => enabledSpeedSeries.includes(item.value))
        .map((item) => ({
          name: item.value,
          label: `${item.label} стр/мин`,
          color: item.color,
          yAxisId: "right",
        })),
    ];
  }, [enabledSpeedSeries, mode]);

  if (loading && !data) {
    return <Skeleton h={360} radius="md" mt="md" />;
  }

  if (error && !data) {
    return (
      <Text size="sm" c="red" mt="md">
        Ошибка аналитики очередей: {error}
      </Text>
    );
  }

  if (!data) return null;

  const current = data.current;
  const summary = data.summary;

  return (
    <Stack mt="md" gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <Title order={5}>Аналитика очередей</Title>
            <Badge color={stateColors[summary.state]}>
              {stateLabels[summary.state]}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {summary.message}
          </Text>
        </Stack>

        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) => setMode(value as ViewMode)}
          data={[
            { label: "Последний час", value: "realtime" },
            { label: "48 часов", value: "hourly" },
            { label: "Дни", value: "daily" },
          ]}
        />
      </Group>

      {error && (
        <Alert color="yellow" title="Данные могут быть не свежими">
          {error}
        </Alert>
      )}

      {summary.scaleSignal && (
        <Alert color="orange" title="Сигнал к масштабированию">
          Очередь или высокая загрузка держались достаточно долго. Стоит
          проверить запас парсеров и пики по часам.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Очередь сейчас
          </Text>
          <Text fw={700} size="xl">
            {metric(current?.total.queued)}
          </Text>
        </Stack>

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            В работе / лимит
          </Text>
          <Text fw={700} size="xl">
            {metric(current?.total.inFlight)} /{" "}
            {metric(current?.total.capacity)}
          </Text>
          <Text size="xs" c="dimmed">
            Отправлено парсерам
          </Text>
        </Stack>

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Перегруз
          </Text>
          <Text
            fw={700}
            size="xl"
            c={current?.total.overload ? "red" : undefined}
          >
            {metric(current?.total.overload)}
          </Text>
        </Stack>

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Готово не забрано
          </Text>
          <Text fw={700} size="xl">
            {metric(current?.total.completedUnfetched)}
          </Text>
          <Text size="xs" c="dimmed">
            Уже собрано, бот ещё не забрал
          </Text>
        </Stack>
      </SimpleGrid>

      {chartRows.length > 0 ? (
        <Stack gap="xs">
          {mode !== "daily" && (
            <Checkbox.Group
              value={enabledSpeedSeries}
              onChange={(value) =>
                setEnabledSpeedSeries(value as SpeedSeriesKey[])
              }
            >
              <Group gap="sm">
                {speedSeriesOptions.map((item) => (
                  <Checkbox
                    key={item.value}
                    size="xs"
                    value={item.value}
                    label={item.label}
                  />
                ))}
              </Group>
            </Checkbox.Group>
          )}

          <LineChart
            h={280}
            data={chartRows}
            dataKey="label"
            withLegend
            withRightYAxis
            rightYAxisLabel="стр/мин"
            curveType="linear"
            series={chartSeries}
          />
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Данных пока недостаточно.
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Где давит
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Проблемный движок</Table.Td>
                <Table.Td>{formatWorstEngine(summary.worstEngine)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Тип выдачи с большей нагрузкой</Table.Td>
                <Table.Td>
                  {summary.devicePressure === "desktop"
                    ? "desktop"
                    : summary.devicePressure === "mobile"
                      ? "mobile"
                      : summary.devicePressure === "balanced"
                        ? "desktop и mobile"
                        : "нет"}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Яндекс в очереди</Table.Td>
                <Table.Td>
                  {metric(current?.byEngine.yandexlive.queued)}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Google в очереди</Table.Td>
                <Table.Td>
                  {metric(current?.byEngine.googlelive.queued)}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Перегрузных минут за час</Table.Td>
                <Table.Td>{summary.overloadMinutesLastHour}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Stack>

        <Stack gap="xs">
          <Text fw={600} size="sm">
            По устройствам сейчас
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Desktop очередь</Table.Td>
                <Table.Td>{metric(current?.total.desktop?.queued)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Desktop в работе</Table.Td>
                <Table.Td>{metric(current?.total.desktop?.inFlight)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Mobile очередь</Table.Td>
                <Table.Td>{metric(current?.total.mobile?.queued)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Mobile в работе</Table.Td>
                <Table.Td>{metric(current?.total.mobile?.inFlight)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Stack>
      </SimpleGrid>

      <Stack gap="xs">
        <Text fw={600} size="sm">
          Пик за историю
        </Text>
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Час пика</Table.Td>
              <Table.Td>
                {summary.peakHour
                  ? hourFmt.format(new Date(summary.peakHour.ts))
                  : "нет данных"}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Макс. очередь</Table.Td>
              <Table.Td>{metric(summary.peakHour?.queuedMax)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Макс. перегруз</Table.Td>
              <Table.Td>{metric(summary.peakHour?.overloadMax)}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Stack>
    </Stack>
  );
}
