// src/entities/admin/model/use-selector-store.ts
import { create } from 'zustand';
import {
  fetchTestBenchSelectorRuns,
  type TestBenchSelectorRun,
} from '@/entities/admin/api/admin-api';

type State = {
  runs: TestBenchSelectorRun[] | null;
  loading: boolean;
  error: string | null;
};

type Actions = {
  fetch: () => Promise<void>;
};

export const useSelectorStore = create<State & Actions>((set) => ({
  runs: null,
  loading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const rows = await fetchTestBenchSelectorRuns(100);
      set({ runs: rows, loading: false });
    } catch (e) {
      set({
        error: (e as Error).message ?? 'Ошибка загрузки селектор-тестов',
        loading: false,
      });
    }
  },
}));
