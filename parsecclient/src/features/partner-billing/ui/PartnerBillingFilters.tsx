'use client';

import { Group, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { ServiceCode } from '@/shared/api/types/service-code';

export interface PartnerBillingFiltersProps {
  group: 'day' | 'month';
  dateFrom: string | null;
  dateTo: string | null;
  services: ServiceCode | 'ALL';
  onChange: <K extends keyof PartnerBillingFiltersProps>(
    field: K,
    value: PartnerBillingFiltersProps[K]
  ) => void;
}

const SERVICE_OPTIONS: { value: ServiceCode | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'YANDEX_LIVE', label: 'Yandex Live' },
  { value: 'GOOGLE_LIVE', label: 'Google Live' },
  { value: 'FREQUENCY', label: 'Частота' },
  // { value: 'GOOGLE_TOP100', label: 'Google TOP100' },
  // { value: 'YANDEX_P1', label: 'Yandex XML P1' },
  // { value: 'WEBMASTER', label: 'Webmaster' },
  // { value: 'WORDSTAT', label: 'Wordstat' },
];

export function PartnerBillingFilters({
  group,
  dateFrom,
  dateTo,
  services,
  onChange,
}: PartnerBillingFiltersProps) {
  return (
    <Group wrap="wrap" gap="md">
      {/* Группировка */}
      <Select
        label="Группировка"
        data={[
          { value: 'day', label: 'По дням' },
          { value: 'month', label: 'По месяцам' },
        ]}
        value={group}
        onChange={(v) =>
          v && onChange('group', v as PartnerBillingFiltersProps['group'])
        }
      />

      {/* Дата от */}
      <DateInput
        label="От"
        value={dateFrom}
        valueFormat="YYYY-MM-DD"
        onChange={(value) => onChange('dateFrom', value)}
        clearable
      />

      {/* Дата до */}
      <DateInput
        label="До"
        value={dateTo}
        valueFormat="YYYY-MM-DD"
        onChange={(value) => onChange('dateTo', value)}
        clearable
      />

      {/* Сервисы */}
      <Select
        label="Сервис"
        data={SERVICE_OPTIONS}
        value={services}
        onChange={(v) =>
          v && onChange('services', v as PartnerBillingFiltersProps['services'])
        }
      />
    </Group>
  );
}
