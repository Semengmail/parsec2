// src/modules/frequency/frequency.constants.ts
export const FREQUENCY_SERVICE_CODE = 'FREQUENCY' as const;
export const WORDSTAT_SERVICE_CODE = 'WORDSTAT' as const;

// Типы частот как в KeyTurbo/твоей БД
export type FrequencyTypeId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const FREQUENCY_TYPES: { id: FrequencyTypeId; name: string }[] = [
  { id: 1, name: 'W' },
  { id: 2, name: '[W]' },
  { id: 3, name: '[!W]' },
  { id: 4, name: '"W"' },
  { id: 5, name: '"!W"' },
  { id: 6, name: '"[W]"' },
  { id: 7, name: '"[!W]"' },
];

export function mapFrequencyTypeNameToId(name: string): FrequencyTypeId | null {
  const item = FREQUENCY_TYPES.find((t) => t.name === name);
  return item ? item.id : null;
}

export function mapFrequencyTypeIdToName(id: number): string | null {
  const item = FREQUENCY_TYPES.find((t) => t.id === id);
  return item ? item.name : null;
}
