import { create } from 'zustand';
import {
  fetchTestBenchRuns,
  type TestBenchRun,
} from '@/entities/admin/api/admin-api';

type State = {
  runs: TestBenchRun[] | null;
  loading: boolean;
  error: string | null;
};

type Actions = {
  fetch: () => Promise<void>;
};

export const useTestBenchStore = create<State & Actions>((set) => ({
  runs: null,
  loading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const rows = await fetchTestBenchRuns(200, 'all');
      set({ runs: rows, loading: false });
    } catch (e) {
      set({
        error: (e as Error).message ?? 'Ошибка загрузки замеров',
        loading: false,
      });
    }
  },
}));
