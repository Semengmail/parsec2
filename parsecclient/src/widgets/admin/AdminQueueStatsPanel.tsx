'use client';

import {
  Card,
  Title,
  Text,
  Group,
  Stack,
  Divider,
  SimpleGrid,
} from '@mantine/core';
import { useAdminStatsStore } from '@/entities/admin/model/use-admin-stats-store';

export function AdminQueueStatsPanel() {
  const { data, loading, error } = useAdminStatsStore();

  return (
    <Card withBorder>
      <Title order={5} mb="md">
        Очереди
      </Title>

      {loading && !data && <Text size="sm">Загрузка…</Text>}
      {error && (
        <Text size="sm" c="red">
          Ошибка: {error}
        </Text>
      )}

      {data && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {/* === 1. Общее === */}
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Общее
            </Text>
            <Divider my={2} />
            <Text size="sm">В очереди(ждут отправки): {data.total.queued}</Text>
            <Text size="sm">
              В работе(отправлено на обработку): {data.total.inflight}
            </Text>
            <Text size="sm">Отправлены: {data.total.sent}</Text>
            <Text size="sm">
              Опрос(ожидают готовности): {data.total.polling}
            </Text>
            <Text size="sm">
              Завершено (не забраны): {data.total.completed_unfetched}
            </Text>
          </Stack>

          {/* === 2. По движкам === */}
          <Stack gap={4}>
            <Text fw={600} size="sm">
              По движкам
            </Text>
            <Divider my={2} />
            <Text size="sm" fw={500}>
              Яндекс Live
            </Text>
            <Group gap="xs" wrap="nowrap" pl="sm">
              <Text size="sm" c="dimmed">
                В работе:
              </Text>
              <Text size="sm">{data.byEngine.yandexlive.inflight}</Text>
            </Group>
            <Group gap="xs" wrap="nowrap" pl="sm">
              <Text size="sm" c="dimmed">
                В очереди:
              </Text>
              <Text size="sm">{data.byEngine.yandexlive.queued}</Text>
            </Group>

            <Text size="sm" fw={500} mt="xs">
              Google Live
            </Text>
            <Group gap="xs" wrap="nowrap" pl="sm">
              <Text size="sm" c="dimmed">
                В работе:
              </Text>
              <Text size="sm">{data.byEngine.googlelive.inflight}</Text>
            </Group>
            <Group gap="xs" wrap="nowrap" pl="sm">
              <Text size="sm" c="dimmed">
                В очереди:
              </Text>
              <Text size="sm">{data.byEngine.googlelive.queued}</Text>
            </Group>
          </Stack>

          {/* === 3. Лимиты === */}
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Лимиты
            </Text>
            <Divider my={2} />
            <Text size="sm">Глобальный максимум: {data.limits.globalMax}</Text>
            <Text size="sm">
              Сейчас в работе: {data.limits.currentInFlightTotal}
            </Text>
            <Text size="sm">Доступно: {data.limits.available}</Text>

            <Divider my={4} />
            <Text size="sm" fw={500}>
              Пределы по движкам:
            </Text>
            <Text size="sm" pl="sm">
              Яндекс: {data.limits.yandexliveCap}
            </Text>
            <Text size="sm" pl="sm">
              Google: {data.limits.googleliveCap}
            </Text>
          </Stack>
        </SimpleGrid>
      )}
    </Card>
  );
}
