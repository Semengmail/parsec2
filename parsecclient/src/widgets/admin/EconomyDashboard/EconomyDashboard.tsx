'use client';

import { useEffect } from 'react';
import { Card, Stack, Title } from '@mantine/core';
import { useEconomyStore } from '@/features/economy/model/use-economy-store';

import { TopupClientsChart } from './charts/TopupClientsChart';
import { RevenueByMonthChart } from './charts/RevenueByMonthChart';
import { TopupsMonthWeeksChart } from './charts/TopupsMonthWeeksChart';
import { RegistrationsChart } from './charts/RegistrationsChart';

export default function EconomyDashboard() {
  const { loadAll, loading, topupClients, revenue, topups, registrations } =
    useEconomyStore();

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (loading) return <div>Загрузка…</div>;

  if (!topupClients || !revenue || !topups || !registrations)
    return <div>Нет данных</div>;

  return (
    <Stack>
      <Card withBorder>
        <Title order={3}>Клиенты, пополнившие ≥ 100 ₽</Title>
        <TopupClientsChart data={topupClients} />
      </Card>

      <Card withBorder>
        <Title order={3}>Прибыль по сервисам</Title>
        <RevenueByMonthChart data={revenue} />
      </Card>

      <Card withBorder>
        <Title order={3}>Пополнения по месяцам и неделям</Title>
        <TopupsMonthWeeksChart data={topups} />
      </Card>

      <Card withBorder>
        <Title order={3}>Регистрации</Title>
        <RegistrationsChart data={registrations} />
      </Card>
    </Stack>
  );
}
