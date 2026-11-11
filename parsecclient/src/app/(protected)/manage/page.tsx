"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, Card, Title, Text, Stack } from "@mantine/core";
import { useAuthStore } from "@/entities/user/model/use-auth-store";
import { useAdminStatsStore } from "@/entities/admin/model/use-admin-stats-store";
import { AdminQueueStatsPanel } from "@/widgets/admin/AdminQueueStatsPanel";
import { AdminQueueAnalyticsPanel } from "@/widgets/admin/AdminQueueAnalyticsPanel";
import { AdminTaskStatsPanel } from "@/widgets/admin/AdminTaskStatsPanel";
import { AdminTestBenchPanel } from "@/widgets/admin/AdminTestBenchPanel";
import { Paths } from "@/shared/config/paths";
import TestBenchDashboard from "@/widgets/admin/TestBenchDashboard/TestBenchDashboard";
import { AdminPartnerBillingPage } from "@/features/partner-billing/pages/AdminPartnerBillingPage";
import EconomyDashboard from "@/widgets/admin/EconomyDashboard/EconomyDashboard";
import { AdminThroughputPanel } from "@/widgets/admin/AdminThroughputPanel/AdminThroughputPanel";
import { AdminSettingsPanel } from "@/widgets/admin/AdminSettingsPanel";
import { AdminUsersPanel } from "@/widgets/admin/AdminUsersPanel";

export default function ManagePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { startPolling, stopPolling } = useAdminStatsStore();

  const isAdmin = !!user?.role?.includes("admin");

  // Редирект, если не админ
  useEffect(() => {
    if (user && !isAdmin) router.replace(Paths.DASHBOARD);
  }, [user, isAdmin, router]);

  // Авто-поллинг только для админов
  useEffect(() => {
    if (isAdmin) {
      startPolling(5000);
      return () => stopPolling();
    }
  }, [isAdmin, startPolling, stopPolling]);

  if (!user) return <Text>Загрузка профиля…</Text>;
  if (!isAdmin) return null;

  return (
    <Stack p="md">
      <Title order={2}>Админка</Title>

      <Tabs defaultValue="s1" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="s1">Очереди</Tabs.Tab>
          <Tabs.Tab value="s2">Тест-бенч</Tabs.Tab>
          <Tabs.Tab value="s3">Пользователи</Tabs.Tab>
          <Tabs.Tab value="s4">Настройки</Tabs.Tab>
          <Tabs.Tab value="s5">Партнёрка</Tabs.Tab>
          <Tabs.Tab value="s6">Экономика</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="s1" pt="md">
          <Card withBorder>
            <AdminQueueStatsPanel />
            <AdminQueueAnalyticsPanel />
            <AdminTaskStatsPanel />
            <AdminThroughputPanel />
            <AdminTestBenchPanel />
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="s2" pt="md">
          <Card withBorder>
            <TestBenchDashboard />
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="s3" pt="md">
          <Card withBorder>
            <AdminUsersPanel />
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="s4" pt="md">
          <Card withBorder>
            <AdminSettingsPanel />
          </Card>
        </Tabs.Panel>
        <Tabs.Panel value="s5" pt="md">
          <Card withBorder>
            <AdminPartnerBillingPage />
          </Card>
        </Tabs.Panel>
        <Tabs.Panel value="s6" pt="md">
          <Card withBorder>
            <EconomyDashboard />
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
