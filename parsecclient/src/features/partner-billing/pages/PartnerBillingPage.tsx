'use client';

import { useEffect, useState } from 'react';
import { Container, Stack, Alert, Text } from '@mantine/core';

import {
  PartnerBillingFilters,
  PartnerBillingFiltersProps,
} from '../ui/PartnerBillingFilters';
import { PartnerBillingTable } from '../ui/PartnerBillingTable';
import { apiGetPartnerReport } from '../api/partnerBillingApi';
import type { ServiceCode } from '@/shared/api/types/service-code';

type PartnerBillingFilterState = {
  group: 'day' | 'month';
  dateFrom: string | null;
  dateTo: string | null;
  services: ServiceCode | 'ALL';
};

export function PartnerBillingPage() {
  const [filters, setFilters] = useState<PartnerBillingFilterState>({
    group: 'day',
    dateFrom: null,
    dateTo: null,
    services: 'ALL',
  });

  const [data, setData] = useState<Awaited<
    ReturnType<typeof apiGetPartnerReport>
  > | null>(null);

  const onChange: PartnerBillingFiltersProps['onChange'] = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  async function load() {
    const d = await apiGetPartnerReport({
      ...filters,
      dateFrom: filters.dateFrom ?? undefined,
      dateTo: filters.dateTo ?? undefined,
      services: filters.services === 'ALL' ? undefined : filters.services,
    });

    setData(d);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <Container size="xl">
      <Stack gap="lg">
        {/* === вывод SOFT_ID === */}
        {data?.softId && (
          <Alert color="green" variant="light" radius="md">
            <Text fw={600} size="lg">
              Ваш soft_id:{' '}
              <span style={{ color: '#0a7f0a' }}>{data.softId}</span>
            </Text>
            <Text size="sm">
              Добавьте его URL парсинга вашего приложения
              ?user=xxx&key=xxx&soft_id={data.softId}
            </Text>
          </Alert>
        )}

        <PartnerBillingFilters {...filters} onChange={onChange} />

        {data && <PartnerBillingTable rows={data.rows} />}
      </Stack>
    </Container>
  );
}
