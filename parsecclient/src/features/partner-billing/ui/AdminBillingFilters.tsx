'use client';

import { useEffect, useState } from 'react';
import { Group, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { ServiceCode } from '@/shared/api/types/service-code';
import { apiGetSoftIds } from '../api/partnerBillingApi';

export type AdminBillingFilterState = {
  group: 'day' | 'month';
  dateFrom: string | null;
  dateTo: string | null;
  services: ServiceCode | 'ALL';
  softId: string | 'ALL';
};

export type AdminBillingChangeHandler = <
  K extends keyof AdminBillingFilterState
>(
  field: K,
  value: AdminBillingFilterState[K]
) => void;

export interface AdminBillingFiltersProps extends AdminBillingFilterState {
  onChange: AdminBillingChangeHandler;
}

// список сервисов из enum
const SERVICE_OPTIONS: { value: ServiceCode | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все сервисы' },
  { value: 'YANDEX_LIVE', label: 'Yandex Live' },
  { value: 'GOOGLE_LIVE', label: 'Google Live' },
  { value: 'FREQUENCY', label: 'Частота' },
];

export function AdminBillingFilters({
  group,
  dateFrom,
  dateTo,
  services,
  softId,
  onChange,
}: AdminBillingFiltersProps) {
  const [softIds, setSoftIds] = useState<string[]>([]);

  useEffect(() => {
    apiGetSoftIds()
      .then(setSoftIds)
      .catch(() => setSoftIds([]));
  }, []);

  return (
    <Group wrap="wrap" gap="md">
      {/* ------------ Группировка -------------- */}
      <Select
        label="Группировка"
        data={[
          { value: 'day', label: 'По дням' },
          { value: 'month', label: 'По месяцам' },
        ]}
        value={group}
        onChange={(v) => {
          if (v === 'day' || v === 'month') onChange('group', v);
        }}
      />

      {/* ------------ Дата от ------------ */}
      <DateInput
        label="От"
        value={dateFrom}
        valueFormat="YYYY-MM-DD"
        onChange={(v) => onChange('dateFrom', v)}
      />

      {/* ------------ Дата до ------------ */}
      <DateInput
        label="До"
        value={dateTo}
        valueFormat="YYYY-MM-DD"
        onChange={(v) => onChange('dateTo', v)}
      />

      {/* ------------ Сервисы ------------ */}
      <Select
        label="Сервис"
        value={services}
        data={SERVICE_OPTIONS}
        onChange={(v) => {
          if (v) onChange('services', v as ServiceCode | 'ALL');
        }}
      />

      {/* ------------ softId ------------ */}
      <Select
        label="softId"
        value={softId}
        searchable
        clearable
        placeholder="Выберите softId"
        data={[
          { value: 'ALL', label: 'Все' },
          ...softIds.map((s) => ({ value: s, label: s })),
        ]}
        onChange={(v) => {
          if (!v) onChange('softId', 'ALL');
          else onChange('softId', v);
        }}
      />
    </Group>
  );
}
