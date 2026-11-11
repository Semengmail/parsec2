// src/entities/admin/model/use-testbench-checks-store.ts
import { create } from 'zustand';
import {
  fetchTestBenchChecks,
  type TestBenchCheck,
} from '@/entities/admin/api/admin-api';

type EngineFilter = 'all' | 'yandex' | 'google';

type State = {
  checks: TestBenchCheck[] | null;
  loading: boolean;
  error: string | null;
  engine: EngineFilter;
  days: number;
};

type Actions = {
  setEngine: (engine: EngineFilter) => void;
  setDays: (days: number) => void;
  fetch: () => Promise<void>;
};

export const useTestBenchChecksStore = create<State & Actions>((set, get) => ({
  checks: null,
  loading: false,
  error: null,
  engine: 'all',
  days: 5,

  setEngine(engine) {
    set({ engine });
  },

  setDays(days) {
    set({ days });
  },

  async fetch() {
    const { engine, days } = get();
    set({ loading: true, error: null });
    try {
      const rows = await fetchTestBenchChecks({ engine, days });
      set({ checks: rows, loading: false });
    } catch (e) {
      set({
        error: (e as Error).message ?? 'Ошибка загрузки чеков',
        loading: false,
      });
    }
  },
}));
