import { create } from 'zustand';
import { apiGetAdminStatus, type AdminQueueStats } from '../api/admin-api';

type State = {
  data: AdminQueueStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  _pollTimer: number | null;
};

type Actions = {
  refresh: () => Promise<void>;
  startPolling: (ms?: number) => void;
  stopPolling: () => void;
};

export const useAdminStatsStore = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastUpdated: null,
  _pollTimer: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiGetAdminStatus();
      set({ data, loading: false, lastUpdated: Date.now() });
    } catch (e) {
      const msg = (e as Error)?.message ?? 'failed_to_load_admin_status';
      set({ loading: false, error: msg });
    }
  },

  startPolling: (ms = 5000) => {
    const { _pollTimer } = get();
    if (_pollTimer) return; // уже запущен
    // сразу один запрос
    void get().refresh();
    const id = window.setInterval(() => {
      void get().refresh();
    }, ms);
    set({ _pollTimer: id });
  },

  stopPolling: () => {
    const { _pollTimer } = get();
    if (_pollTimer) {
      window.clearInterval(_pollTimer);
      set({ _pollTimer: null });
    }
  },
}));
