// src\widgets\admin\TestBenchDashboard\TestBenchDashboard.tsx
'use client';

import { Stack, Title, Divider } from '@mantine/core';
import { AlertsPanel } from '../AlertsPanel/AlertsPanel';
import { PositionsPanel } from './PositionsPanel';
import { SelectorPanel } from './SelectorPanel';
import { SummaryPanel } from './TestBenchSummary';
import TestBenchAdminPanel from '../TestBenchAdminPanel/TestBenchAdminPanel';
import { TestBenchCaptcha } from '../TestBenchCaptcha';

export default function TestBenchDashboard() {
  return (
    <Stack gap="lg">
      <Title order={3}>Тесты стабильности работы скриптов</Title>

      <SummaryPanel />
      <PositionsPanel />
      <Divider />

      <SelectorPanel />
      <Divider />

      <AlertsPanel />
      <Divider />
      <TestBenchAdminPanel />
      <Divider />
      <TestBenchCaptcha />
    </Stack>
  );
}
