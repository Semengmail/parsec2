'use client';

import { Card, Text, Stack } from '@mantine/core';
import type { PartnerBillingSummary } from '../api/partnerBillingApi';

export function PartnerBillingSummary({
  summary,
}: {
  summary: PartnerBillingSummary;
}) {
  return (
    <Card shadow="sm" padding="md" withBorder>
      <Stack gap="xs">
        <Text fw={600}>Всего запросов: {summary.totalRequests}</Text>
        <Text fw={600}>
          Общая сумма: {(Number(summary.totalAmount) / 1000).toFixed(2)} ₽
        </Text>

        <Text mt="sm" fw={700}>
          Сервисы:
        </Text>
        {Object.entries(summary.byService).map(([svc, row]) => (
          <Text key={svc}>
            {svc}: {row.requests} запросов —{' '}
            {(Number(row.amount) / 1000).toFixed(2)} ₽
          </Text>
        ))}
      </Stack>
    </Card>
  );
}
