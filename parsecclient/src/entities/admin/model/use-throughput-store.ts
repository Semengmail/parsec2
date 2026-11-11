import { create } from 'zustand';
import {
  deleteThroughputStats,
  fetchThroughputRecords,
  rebuildThroughput,
  ThroughputRecord,
} from '@/entities/admin/api/admin-api';

type State = {
  data: ThroughputRecord[];
  loading: boolean;
  rebuilding: boolean;
  deletingKey: string | null;
  error: string | null;
};

type Actions = {
  fetch: () => Promise<void>;
  rebuild: (days?: number) => Promise<void>;
  remove: (params: { server: string; engine: string }) => Promise<void>;
};

export const useThroughputStore = create<State & Actions>((set, get) => ({
  data: [],
  loading: false,
  rebuilding: false,
  deletingKey: null,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const res = await fetchThroughputRecords();
      set({ data: res, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async rebuild(days = 14) {
    set({ rebuilding: true, error: null });
    try {
      await rebuildThroughput(days);
      // сразу перезагружаем данные
      await get().fetch();
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ rebuilding: false });
    }
  },

  async remove({ server, engine }) {
    const deletingKey = `${server}::${engine}`;
    set({ deletingKey, error: null });

    try {
      await deleteThroughputStats({ server, engine });
      set((state) => ({
        data: state.data.filter(
          (row) => row.server !== server || row.searchEngine !== engine,
        ),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ deletingKey: null });
    }
  },
}));
