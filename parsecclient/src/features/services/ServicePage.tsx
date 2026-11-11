// src/features/services/ServicePage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { SideNav } from '@/widgets/side-nav/SideNav';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { BarChart } from '@mantine/charts';
import {
  getServiceSummary,
  getServiceSeries,
  getServiceSettings,
  saveServiceSettings,
  type ServiceSummary,
  type SeriesPoint,
  type ServiceSettingsDto,
  type SettingsResponse,
} from './api';
import { formatRubHumanThousandths } from '@/shared/utils/money/formatThousandths';
import { AppHeader } from '@/widgets/app-header/AppHeader';
import { BalanceModal } from '../payment';

type GroupKey = 'hour' | 'day' | 'month';

const getDefaultLr = (slug: string) => {
  switch (slug) {
    case 'yandex-live':
      return 225;
    case 'yandex':
      return 225;
    case 'google-live':
      return 2643;
    default:
      return 213;
  }
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function toNumberOrNull(v: unknown): number | null {
  if (isFiniteNumber(v)) return v;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function thousandthsToRubNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n / 1000 : 0;
}

/** Нормализуем настройки: заполняем дефолты, чтобы сохранялись даже без взаимодействия с полями */
function normalizeSettings(st: SettingsResponse): ServiceSettingsDto {
  const s = st.settings ?? {};
  const slug = st.descriptor.slug;
  const defaultLr = getDefaultLr(slug);
  const supports = st.descriptor.supports;
  return {
    // дефолты — только если сервис это поддерживает
    device: supports.device ? s.device ?? 'desktop' : undefined,
    lr: supports.lr ? (isFiniteNumber(s.lr) ? s.lr : defaultLr) : undefined,
    latitude:
      supports.geo && s.latitude != null
        ? toNumberOrNull(s.latitude) ?? null
        : supports.geo
        ? null
        : undefined,
    longitude:
      supports.geo && s.longitude != null
        ? toNumberOrNull(s.longitude) ?? null
        : supports.geo
        ? null
        : undefined,
  };
}

/** Надёжное копирование в буфер обмена (HTTPS не обязателен, есть фолбэк) */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ServicePage({ slug }: { slug: string }) {
  const [balanceModalOpened, setBalanceModalOpened] = useState(false);
  const [sum, setSum] = useState<ServiceSummary | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [group, setGroup] = useState<GroupKey>('day');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultLr = getDefaultLr(slug);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, stRaw] = await Promise.all([
          getServiceSummary(slug),
          getServiceSettings(slug),
        ]);
        if (!alive) return;
        setSum(s);
        // сразу нормализуем (чтобы дефолты попали в состояние)
        const st: SettingsResponse = {
          ...stRaw,
          settings: normalizeSettings(stRaw),
        };

        setSettings(st);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await getServiceSeries(slug, group);
        if (!alive) return;
        setSeries(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, group]);

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        label: p.at,
        amount: thousandthsToRubNumber(p.amount),
        amountLabel: formatRubHumanThousandths(p.amount),
      })),
    [series]
  );

  const publicUrl = settings?.publicUrlExample ?? '';
  const publicResultsUrl = settings?.publicUrlResultsExample ?? '';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <AppHeader />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />

        <main style={{ padding: 16, flex: 1 }}>
          <Title order={2} mb="md">
            {settings?.descriptor.title ?? 'Сервис'}
          </Title>

          <Grid gutter="lg">
            {/* Левая колонка */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="lg">
                <Card withBorder>
                  <Title order={5}>Состояние по направлению</Title>
                  <Stack gap={6} mt="sm">
                    <Text>
                      Расход сегодня:{' '}
                      <b>
                        {sum ? formatRubHumanThousandths(sum.spend.today) : '—'}
                      </b>
                    </Text>
                    <Text>
                      За 7 дней:{' '}
                      <b>
                        {sum
                          ? formatRubHumanThousandths(sum.spend.last7d)
                          : '—'}
                      </b>
                    </Text>
                    <Text>
                      За 30 дней:{' '}
                      <b>
                        {sum
                          ? formatRubHumanThousandths(sum.spend.last30d)
                          : '—'}
                      </b>
                    </Text>
                    <Group gap="xs" mt="xs">
                      <Badge title="Цена за единицу">
                        {sum
                          ? formatRubHumanThousandths(sum.pricePerUnit)
                          : '—'}
                      </Badge>
                      {sum && (
                        <Badge title="Доступно запросов">
                          {sum.queriesLeft}
                        </Badge>
                      )}
                    </Group>
                    <Button
                      mt="md"
                      onClick={() => setBalanceModalOpened(true)}
                      variant="light"
                    >
                      Пополнить баланс
                    </Button>
                  </Stack>
                </Card>

                <Card withBorder>
                  <Title order={5}>Помощь</Title>
                  <Stack gap={6} mt="sm">
                    {settings?.descriptor.help.map((l) => (
                      <Anchor key={l.title} href={l.href} target="_blank">
                        {l.title}
                      </Anchor>
                    )) ?? <Text c="dimmed">—</Text>}
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>

            {/* Правая колонка */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Tabs defaultValue="settings" keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab value="settings">Настройки</Tabs.Tab>
                  <Tabs.Tab value="expenses">Расходы</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="settings" pt="md">
                  <Card withBorder>
                    <Title order={5}>Базовые настройки</Title>

                    {/* Превью публичного API */}
                    <Stack gap="xs" mt="sm">
                      <Text fw={500}>
                        Ваш публичный API URL для создания задачи(метод{' '}
                        {settings?.descriptor.method})
                      </Text>
                      <Group wrap="nowrap">
                        <TextInput
                          value={publicUrl}
                          readOnly
                          style={{ flex: 1 }}
                        />
                        <Tooltip label={copied ? 'Скопировано' : 'Скопировать'}>
                          <Button
                            variant="light"
                            onClick={async () => {
                              if (!publicUrl) return;
                              const ok = await copyToClipboard(publicUrl);
                              setCopied(ok);
                              setTimeout(() => setCopied(false), 1500);
                            }}
                          >
                            {copied ? 'OK' : 'Копировать'}
                          </Button>
                        </Tooltip>
                      </Group>
                    </Stack>

                    {publicResultsUrl && (
                      <Stack gap="xs" mt="sm">
                        <Text fw={500}>API URL для получения результатов</Text>
                        <Group wrap="nowrap">
                          <TextInput
                            value={publicResultsUrl}
                            readOnly
                            style={{ flex: 1 }}
                          />
                          <Tooltip
                            label={copied ? 'Скопировано' : 'Скопировать'}
                          >
                            <Button
                              variant="light"
                              onClick={async () => {
                                if (!publicResultsUrl) return;
                                const ok = await copyToClipboard(
                                  publicResultsUrl
                                );
                                setCopied(ok);
                                setTimeout(() => setCopied(false), 1500);
                              }}
                            >
                              {copied ? 'OK' : 'Копировать'}
                            </Button>
                          </Tooltip>
                        </Group>
                      </Stack>
                    )}

                    {settings && (
                      <Stack gap="sm" mt="md">
                        {settings.descriptor.supports.device && (
                          <Select
                            label="Устройство"
                            data={[
                              { value: 'desktop', label: 'Desktop' },
                              { value: 'mobile', label: 'Mobile' },
                            ]}
                            value={settings.settings.device ?? 'desktop'}
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      settings: {
                                        ...s.settings,
                                        device:
                                          (v as 'desktop' | 'mobile') ??
                                          'desktop',
                                      },
                                    }
                                  : s
                              )
                            }
                          />
                        )}

                        {settings.descriptor.supports.lr && (
                          <NumberInput
                            label="LR (регион, будет задан по умолчанию если не передан)"
                            value={settings.settings.lr ?? ''}
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      settings: {
                                        ...s.settings,
                                        lr:
                                          typeof v === 'number'
                                            ? v
                                            : toNumberOrNull(v) ?? defaultLr,
                                      },
                                    }
                                  : s
                              )
                            }
                          />
                        )}

                        {settings.descriptor.supports.geo && (
                          <Group grow>
                            <NumberInput
                              label="Latitude"
                              value={settings.settings.latitude ?? undefined}
                              onChange={(v) =>
                                setSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        settings: {
                                          ...s.settings,
                                          latitude:
                                            v === '' ? null : toNumberOrNull(v),
                                        },
                                      }
                                    : s
                                )
                              }
                            />
                            <NumberInput
                              label="Longitude"
                              value={settings.settings.longitude ?? undefined}
                              onChange={(v) =>
                                setSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        settings: {
                                          ...s.settings,
                                          longitude:
                                            v === '' ? null : toNumberOrNull(v),
                                        },
                                      }
                                    : s
                                )
                              }
                            />
                          </Group>
                        )}

                        <Group mt="sm">
                          <Button
                            loading={saving}
                            onClick={async () => {
                              if (!settings) return;
                              setSaving(true);
                              try {
                                // перед сохранением ещё раз нормализуем
                                const normalized = normalizeSettings(settings);
                                await saveServiceSettings(slug, normalized);
                                // перезапросим, чтобы обновить publicUrlExample
                                const stRaw = await getServiceSettings(slug);
                                setSettings({
                                  ...stRaw,
                                  settings: normalizeSettings(stRaw),
                                });
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            Сохранить
                          </Button>
                        </Group>
                      </Stack>
                    )}

                    {!settings && <Text mt="sm">Загрузка…</Text>}
                  </Card>
                </Tabs.Panel>

                <Tabs.Panel value="expenses" pt="md">
                  <Card withBorder>
                    <Group justify="space-between" mb="md">
                      <Title order={5}>График расходов</Title>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant={group === 'hour' ? 'filled' : 'light'}
                          onClick={() => setGroup('hour')}
                        >
                          По часам
                        </Button>
                        <Button
                          size="xs"
                          variant={group === 'day' ? 'filled' : 'light'}
                          onClick={() => setGroup('day')}
                        >
                          По дням
                        </Button>
                        <Button
                          size="xs"
                          variant={group === 'month' ? 'filled' : 'light'}
                          onClick={() => setGroup('month')}
                        >
                          По месяцам
                        </Button>
                      </Group>
                    </Group>

                    {!sum || loading ? (
                      <Text>Загрузка…</Text>
                    ) : chartData.length === 0 ? (
                      <Text c="dimmed">Нет данных</Text>
                    ) : (
                      <BarChart
                        h={320}
                        data={chartData}
                        dataKey="label"
                        series={[
                          { name: 'amount', label: 'Расход', color: 'blue.6' },
                        ]}
                        withLegend
                        gridAxis="x"
                        fillOpacity={1}
                        minBarSize={4}
                        valueFormatter={(v) =>
                          v.toLocaleString('ru-RU', {
                            maximumFractionDigits: 3,
                          }) + ' ₽'
                        }
                        tooltipProps={{
                          content: ({ label, payload }) => {
                            const p = payload?.[0]?.payload as
                              | { amountLabel?: string }
                              | undefined;

                            return (
                              <Card padding="xs" radius="sm" withBorder>
                                <Text fw={600}>{label}</Text>
                                <Group gap="xs" mt={6}>
                                  <Text size="sm" c="blue.6">
                                    ●
                                  </Text>
                                  <Text size="sm">Расход</Text>
                                  <Text size="sm" fw={500} ml="auto">
                                    {p?.amountLabel ?? '0 ₽'}
                                  </Text>
                                </Group>
                              </Card>
                            );
                          },
                        }}
                      />
                    )}
                  </Card>
                </Tabs.Panel>
              </Tabs>
            </Grid.Col>
          </Grid>
        </main>
      </div>
      <BalanceModal
        opened={balanceModalOpened}
        onClose={() => setBalanceModalOpened(false)}
      />
    </div>
  );
}
