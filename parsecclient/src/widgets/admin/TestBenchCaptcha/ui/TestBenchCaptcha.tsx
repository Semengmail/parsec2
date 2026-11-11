import { useEffect, useState } from 'react';
import { CaptchaChart } from './CaptchaChart';
import { CaptchaConfigForm } from './CaptchaConfigForm';
import { CaptchaTable } from './CaptchaTable';
import {
  ActionIcon,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCopy, IconFileText, IconTrash } from '@tabler/icons-react';
import { useTestBenchStore } from '@/features/test-bench/store';
import { groupCaptchaMetrics } from '../hooks/groupCaptchaMetrics';
import { formatMetricDate } from '../utils/formatDate';
import { TestBenchCaptchaMetric } from '@/features/test-bench/api';
import { showNotification } from '@/shared/utils/notifications/showNotification';
import { showError } from '@/shared/utils/notifications/showError';
import { copyToClipboard } from '@/shared/utils/clipboard/copyToClipboard';
import styles from './TestBenchCaptcha.module.css';

type CaptchaCollectionKey =
  | 'yandex-desktop'
  | 'yandex-mobile'
  | 'google-desktop'
  | 'google-mobile';

const CAPTCHA_COLLECTIONS: {
  value: CaptchaCollectionKey;
  label: string;
  engine: TestBenchCaptchaMetric['engine'];
  device: TestBenchCaptchaMetric['device'];
}[] = [
  {
    value: 'yandex-mobile',
    label: 'Яндекс Mobile',
    engine: 'yandex',
    device: 'mobile',
  },
  {
    value: 'yandex-desktop',
    label: 'Яндекс Desktop',
    engine: 'yandex',
    device: 'desktop',
  },
  {
    value: 'google-mobile',
    label: 'Google Mobile',
    engine: 'google',
    device: 'mobile',
  },
  {
    value: 'google-desktop',
    label: 'Google Desktop',
    engine: 'google',
    device: 'desktop',
  },
];

function sortDatesAsc(dates: string[]) {
  return [...dates].sort((a, b) => (a > b ? 1 : -1));
}

function formatMetricValue(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function formatZeroPercent(zeroCount: number, samplesTotal: number) {
  if (samplesTotal <= 0) return '0.0';
  return ((zeroCount / samplesTotal) * 100).toFixed(1);
}

function formatHistogram(histogram: Record<string, number>) {
  const rows = Object.entries(histogram).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );

  if (rows.length === 0) return ['    - распределение: нет данных'];

  return [
    '    - распределение проходов до капчи:',
    ...rows.map(([passes, count]) => `      ${passes}: ${count}`),
  ];
}

function averageNonZero(metrics: TestBenchCaptchaMetric[]) {
  const values = metrics.map((m) => m.avgNonZero).filter((v) => v > 0);
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isMetricInDates(metric: TestBenchCaptchaMetric, dates: string[]) {
  return dates.includes(formatMetricDate(metric.collectedAt));
}

function isMetricInCollection(
  metric: TestBenchCaptchaMetric,
  collection: (typeof CAPTCHA_COLLECTIONS)[number]
) {
  return (
    metric.engine === collection.engine && metric.device === collection.device
  );
}

function getCollectionMetricsCount(
  history: TestBenchCaptchaMetric[],
  dates: string[],
  collection: (typeof CAPTCHA_COLLECTIONS)[number]
) {
  return history.filter(
    (metric) =>
      isMetricInDates(metric, dates) && isMetricInCollection(metric, collection)
  ).length;
}

function getAvailableCollections(
  history: TestBenchCaptchaMetric[],
  dates: string[]
) {
  return CAPTCHA_COLLECTIONS.filter(
    (collection) => getCollectionMetricsCount(history, dates, collection) > 0
  );
}

function getServerMetricsCount({
  history,
  dates,
  collections,
  serverId,
}: {
  history: TestBenchCaptchaMetric[];
  dates: string[];
  collections: CaptchaCollectionKey[];
  serverId: string;
}) {
  const selectedCollections = CAPTCHA_COLLECTIONS.filter((collection) =>
    collections.includes(collection.value)
  );

  return history.filter(
    (metric) =>
      metric.serverId === serverId &&
      isMetricInDates(metric, dates) &&
      selectedCollections.some((collection) =>
        isMetricInCollection(metric, collection)
      )
  ).length;
}

function buildCaptchaAnalysisReport({
  history,
  dates,
  collections,
  servers,
}: {
  history: TestBenchCaptchaMetric[];
  dates: string[];
  collections: CaptchaCollectionKey[];
  servers: string[];
}) {
  const selectedDates = sortDatesAsc(dates);
  const selectedCollections = CAPTCHA_COLLECTIONS.filter((collection) =>
    collections.includes(collection.value)
  );
  const selectedMetrics = history.filter((metric) => {
    const metricDate = formatMetricDate(metric.collectedAt);
    return (
      selectedDates.includes(metricDate) &&
      servers.includes(metric.serverId) &&
      selectedCollections.some(
        (collection) =>
          collection.engine === metric.engine &&
          collection.device === metric.device
      )
    );
  });

  const reportServers = Array.from(
    new Set(selectedMetrics.map((metric) => metric.serverId))
  ).sort();

  const lines: string[] = [
    'ОТЧЕТ ПО КАПЧА-МЕТРИКАМ',
    `Даты сборов: ${selectedDates.join(', ')}`,
    `Выбранные сборы: ${selectedCollections.map((c) => c.label).join(', ')}`,
    `Выбранные серверы: ${servers.length > 0 ? servers.join(', ') : 'нет'}`,
    `Серверов с данными в отчете: ${reportServers.length}`,
    '',
    'Что считать важным:',
    '- zeroCaptchaCount: сколько раз капча появилась сразу, без проходов до капчи',
    '- avgTotal: среднее число проходов до капчи с учетом нулевых значений',
    '- avgNonZero: среднее число проходов до капчи без нулевых значений',
    '- histogram: распределение, где ключ это число проходов до капчи, значение это количество замеров',
    '',
  ];

  for (const collection of selectedCollections) {
    lines.push(`=== ${collection.label} ===`, '');

    lines.push('Сводка по датам:');
    for (const date of selectedDates) {
      const dateMetrics = selectedMetrics.filter(
        (metric) =>
          formatMetricDate(metric.collectedAt) === date &&
          metric.engine === collection.engine &&
          metric.device === collection.device
      );

      if (dateMetrics.length === 0) {
        lines.push(`- ${date}: данных нет`);
        continue;
      }

      const zeroCount = dateMetrics.reduce(
        (sum, metric) => sum + metric.zeroCaptchaCount,
        0
      );
      const samplesTotal = dateMetrics.reduce(
        (sum, metric) => sum + metric.samplesTotal,
        0
      );
      const samplesNonZero = dateMetrics.reduce(
        (sum, metric) => sum + metric.samplesNonZero,
        0
      );

      lines.push(
        `- ${date}: серверов ${dateMetrics.length}, нулевых капч ${zeroCount} (${formatZeroPercent(
          zeroCount,
          samplesTotal
        )}%), среднее без нулевых ${formatMetricValue(
          averageNonZero(dateMetrics)
        )}, замеров ${samplesTotal}, ненулевых ${samplesNonZero}`
      );
    }

    lines.push('', 'По серверам:');
    for (const serverId of reportServers) {
      const serverMetrics = selectedMetrics.filter(
        (metric) =>
          metric.serverId === serverId &&
          metric.engine === collection.engine &&
          metric.device === collection.device
      );

      if (serverMetrics.length === 0) continue;

      lines.push(`Сервер ${serverId}:`);

      for (const date of selectedDates) {
        const metric = serverMetrics.find(
          (item) => formatMetricDate(item.collectedAt) === date
        );

        if (!metric) {
          lines.push(`  ${date}: данных нет`);
          continue;
        }

        lines.push(
          `  ${date}: нулевых капч ${metric.zeroCaptchaCount} (${metric.zeroPercent.toFixed(
            1
          )}%), avgTotal ${formatMetricValue(
            metric.avgTotal
          )}, avgNonZero ${formatMetricValue(metric.avgNonZero)}, замеров ${
            metric.samplesTotal
          }, ненулевых ${metric.samplesNonZero}`
        );
        lines.push(...formatHistogram(metric.histogram));
      }

      lines.push('');
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

export function TestBenchCaptcha() {
  const {
    configs,
    captchaHistory,
    loadConfigs,
    loadCaptchaHistory,
    runCaptchaMetricsReport,
    saveConfig,
    removeCaptchaMetricsByServer,
  } = useTestBenchStore();
  const [captchaReportLoading, setCaptchaReportLoading] = useState(false);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [reportSetupOpened, setReportSetupOpened] = useState(false);
  const [reportResultOpened, setReportResultOpened] = useState(false);
  const [selectedReportDates, setSelectedReportDates] = useState<string[]>([]);
  const [selectedReportCollections, setSelectedReportCollections] = useState<
    CaptchaCollectionKey[]
  >(CAPTCHA_COLLECTIONS.map((collection) => collection.value));
  const [selectedReportServers, setSelectedReportServers] = useState<string[]>(
    []
  );
  const [analysisReport, setAnalysisReport] = useState('');

  useEffect(() => {
    loadConfigs();
    loadCaptchaHistory({ days: 30 });
  }, [loadConfigs, loadCaptchaHistory]);

  if (!configs || !captchaHistory) return <div>Loading...</div>;

  const grouped = groupCaptchaMetrics(captchaHistory);
  const allServerIds = Object.keys(grouped.servers).sort();

  const openReportSetup = () => {
    const dates = grouped.allDates;
    const collections = getAvailableCollections(captchaHistory, dates);

    setSelectedReportDates(dates);
    setSelectedReportCollections(
      collections.map((collection) => collection.value)
    );
    setSelectedReportServers(allServerIds);
    setReportSetupOpened(true);
  };

  const handleReportDatesChange = (dates: string[]) => {
    const collections = getAvailableCollections(captchaHistory, dates);
    const availableValues = collections.map((collection) => collection.value);

    setSelectedReportDates(dates);
    setSelectedReportCollections((current) => {
      const next = current.filter((value) => availableValues.includes(value));
      return next.length > 0 ? next : availableValues;
    });
  };

  const handleCreateAnalysisReport = () => {
    const report = buildCaptchaAnalysisReport({
      history: captchaHistory,
      dates: selectedReportDates,
      collections: selectedReportCollections,
      servers: selectedReportServers,
    });

    setAnalysisReport(report);
    setReportSetupOpened(false);
    setReportResultOpened(true);
  };

  const handleCopyAnalysisReport = async () => {
    const ok = await copyToClipboard(analysisReport);

    if (ok) {
      showNotification('Отчет скопирован');
      return;
    }

    showError('Не удалось скопировать отчет');
  };

  const handleCaptchaReport = async () => {
    setCaptchaReportLoading(true);

    try {
      await runCaptchaMetricsReport();
      showNotification('Капча-метрики пересчитаны');
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Не удалось пересчитать капча-метрики'
      );
    } finally {
      setCaptchaReportLoading(false);
    }
  };

  const handleDeleteServerStats = async (serverId: string) => {
    const confirmed = window.confirm(
      `Удалить всю капча-статистику по серверу ${serverId}?`
    );

    if (!confirmed) return;

    setDeletingServerId(serverId);

    try {
      await removeCaptchaMetricsByServer(serverId);
      showNotification(`Статистика по серверу ${serverId} удалена`);
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Не удалось удалить капча-статистику по серверу'
      );
    } finally {
      setDeletingServerId(null);
    }
  };

  const chartData = grouped.allDates.map((d) => {
    const serversArray = Object.values(grouped.servers);

    const calcAvg = (list: TestBenchCaptchaMetric[], date: string): number => {
      const values = list
        .filter((x) => formatMetricDate(x.collectedAt) === date)
        .map((x) => x.avgNonZero)
        .filter((v) => v > 0); // <-- пропускаем нули

      if (values.length === 0) return 0;

      const sum = values.reduce((a, b) => a + b, 0);
      return Number((sum / values.length).toFixed(2));
    };

    return {
      date: d,

      yandexDesktop: calcAvg(
        serversArray.flatMap((s) => s.yandex.desktop),
        d
      ),

      yandexMobile: calcAvg(
        serversArray.flatMap((s) => s.yandex.mobile),
        d
      ),

      googleDesktop: calcAvg(
        serversArray.flatMap((s) => s.google.desktop),
        d
      ),

      googleMobile: calcAvg(
        serversArray.flatMap((s) => s.google.mobile),
        d
      ),
    };
  });

  return (
    <Stack>
      <Title order={2}>Настройки капча-метрик</Title>

      <CaptchaConfigForm
        config={configs.yandex}
        onSave={(dto) => saveConfig('yandex', dto)}
      />

      <Divider my="md" />

      <CaptchaConfigForm
        config={configs.google}
        onSave={(dto) => saveConfig('google', dto)}
      />

      <Divider my="lg" />

      <Group justify="space-between" align="center">
        <Title order={3}>Среднее значение сборов до капчи</Title>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconFileText size={14} />}
            onClick={openReportSetup}
          >
            Создать отчет
          </Button>
          <Button
            size="xs"
            variant="light"
            loading={captchaReportLoading}
            onClick={handleCaptchaReport}
          >
            Посчитать сейчас
          </Button>
        </Group>
      </Group>
      <CaptchaChart data={chartData} />

      <Divider my="lg" />

      {Object.entries(grouped.servers).map(([serverId, s]) => (
        <Stack key={serverId}>
          <Group gap="xs" className={styles.serverHeader}>
            <Title order={3}>Сервер {serverId}</Title>

            <Tooltip label="Удалить статистику по серверу">
              <ActionIcon
                className={styles.deleteButton}
                color="red"
                variant="subtle"
                size="sm"
                loading={deletingServerId === serverId}
                aria-label={`Удалить статистику по серверу ${serverId}`}
                onClick={() => void handleDeleteServerStats(serverId)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <CaptchaTable
            title="Яндекс Desktop"
            rows={s.yandex.desktop}
            dates={grouped.allDates}
          />

          <CaptchaTable
            title="Яндекс Mobile"
            rows={s.yandex.mobile}
            dates={grouped.allDates}
          />

          <CaptchaTable
            title="Google Desktop"
            rows={s.google.desktop}
            dates={grouped.allDates}
          />

          <CaptchaTable
            title="Google Mobile"
            rows={s.google.mobile}
            dates={grouped.allDates}
          />
        </Stack>
      ))}

      <Modal
        opened={reportSetupOpened}
        onClose={() => setReportSetupOpened(false)}
        title="Создать отчет по капчам"
        size="lg"
      >
        <Stack>
          <Stack gap="xs">
            <Text fw={500}>Даты с существующей статистикой</Text>
            <ScrollArea.Autosize mah={260}>
              <Checkbox.Group
                value={selectedReportDates}
                onChange={handleReportDatesChange}
              >
                <Stack gap={8}>
                  {grouped.allDates.map((date) => (
                    <Checkbox key={date} value={date} label={date} />
                  ))}
                </Stack>
              </Checkbox.Group>
            </ScrollArea.Autosize>
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text fw={500}>Доступные сборы</Text>
            <Checkbox.Group
              value={selectedReportCollections}
              onChange={(value) =>
                setSelectedReportCollections(value as CaptchaCollectionKey[])
              }
            >
              <Stack gap={8}>
                {CAPTCHA_COLLECTIONS.map((collection) => {
                  const count = getCollectionMetricsCount(
                    captchaHistory,
                    selectedReportDates,
                    collection
                  );

                  return (
                    <Checkbox
                      key={collection.value}
                      value={collection.value}
                      disabled={count === 0}
                      label={`${collection.label} (${count})`}
                    />
                  );
                })}
              </Stack>
            </Checkbox.Group>
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text fw={500}>Серверы для сравнения</Text>
            <ScrollArea.Autosize mah={220}>
              <Checkbox.Group
                value={selectedReportServers}
                onChange={setSelectedReportServers}
              >
                <Stack gap={8}>
                  {allServerIds.map((serverId) => {
                    const count = getServerMetricsCount({
                      history: captchaHistory,
                      dates: selectedReportDates,
                      collections: selectedReportCollections,
                      serverId,
                    });

                    return (
                      <Checkbox
                        key={serverId}
                        value={serverId}
                        label={`${serverId} (${count})`}
                      />
                    );
                  })}
                </Stack>
              </Checkbox.Group>
            </ScrollArea.Autosize>
          </Stack>

          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setSelectedReportServers(allServerIds)}
            >
              Все серверы
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setSelectedReportServers([])}
            >
              Снять выбор
            </Button>
          </Group>

          {selectedReportDates.length > 0 &&
            selectedReportCollections.length === 0 && (
              <Text size="sm" c="red">
                Для выбранных дат нет данных по доступным типам сборов.
              </Text>
            )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => setReportSetupOpened(false)}
            >
              Отмена
            </Button>
            <Button
              disabled={
                selectedReportDates.length === 0 ||
                selectedReportServers.length === 0 ||
                selectedReportCollections.length === 0
              }
              onClick={handleCreateAnalysisReport}
            >
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={reportResultOpened}
        onClose={() => setReportResultOpened(false)}
        title="Отчет по капча-метрикам"
        size="xl"
      >
        <Stack>
          <Textarea
            classNames={{ input: styles.reportTextarea }}
            value={analysisReport}
            autosize
            minRows={18}
            maxRows={28}
            readOnly
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              leftSection={<IconCopy size={14} />}
              onClick={handleCopyAnalysisReport}
            >
              Скопировать
            </Button>
            <Button onClick={() => setReportResultOpened(false)}>
              Закрыть
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
