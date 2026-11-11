'use client';

import { useEffect, useState } from 'react';
import { Container, Stack, Loader, Title } from '@mantine/core';

import {
  AdminBillingChangeHandler,
  AdminBillingFilters,
  AdminBillingFilterState,
} from '../ui/AdminBillingFilters';
import { AdminPartnerBillingTable } from '../ui/AdminPartnerBillingTable';
import { apiGetAdminPartnerReport } from '../api/partnerBillingApi';

export function AdminPartnerBillingPage() {
  const [filters, setFilters] = useState<AdminBillingFilterState>({
    group: 'day',
    dateFrom: null,
    dateTo: null,
    services: 'ALL',
    softId: 'ALL',
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof apiGetAdminPartnerReport>
  > | null>(null);

  const handleChange: AdminBillingChangeHandler = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  async function load() {
    setLoading(true);

    const d = await apiGetAdminPartnerReport({
      ...filters,
      dateFrom: filters.dateFrom ?? undefined,
      dateTo: filters.dateTo ?? undefined,
      services: filters.services === 'ALL' ? undefined : filters.services,
      softId: filters.softId === 'ALL' ? undefined : filters.softId,
    });

    setData(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <Container size="xl">
      <Stack gap="lg">
        <AdminBillingFilters {...filters} onChange={handleChange} />

        {loading && <Loader />}

        {!loading && data && (
          <>
            <Title order={3}>
              Всего: {(Number(data.summary.totalAmount) / 1000).toFixed(2)} ₽
            </Title>

            <AdminPartnerBillingTable rows={data.rows} />
          </>
        )}
      </Stack>
    </Container>
  );
}
