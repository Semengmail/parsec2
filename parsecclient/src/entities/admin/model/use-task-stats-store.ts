// src/entities/admin/model/use-task-stats-store.ts
import { create } from 'zustand';
import {
  fetchTaskStats,
  type AggregatedRow,
  type TaskStatsPeriod,
} from '@/entities/admin/api/admin-api';
import {
  fetchLatestSpeed,
  type LatestSpeedResponse,
} from '@/entities/admin/api/admin-api';

type State = {
  period: TaskStatsPeriod;
  engine?: string; // undefined = все
  server?: string; // undefined = все

  data: AggregatedRow[] | null;
  servers: string[];
  engines: string[];

  loading: boolean;
  error: string | null;

  // polling
  _timer?: number;

  latestSpeed: LatestSpeedResponse | null;
};

type Actions = {
  setPeriod: (p: TaskStatsPeriod) => void;
  setEngine: (e?: string) => void;
  setServer: (s?: string) => void;

  fetch: () => Promise<void>;
  startPolling: (ms?: number) => void;
  stopPolling: () => void;

  fetchLatestSpeed: () => Promise<void>;
};

export const useTaskStatsStore = create<State & Actions>((set, get) => ({
  period: 'hour',
  engine: undefined,
  server: undefined,

  data: null,
  servers: [],
  engines: [],

  loading: false,
  error: null,

  latestSpeed: null,

  async fetch() {
    const { period, engine, server } = get();
    set({ loading: true, error: null });
    try {
      const abort = new AbortController();
      const res = await fetchTaskStats({
        period,
        engine,
        server,
        signal: abort.signal,
      });
      set({
        data: res.data,
        servers: res.servers,
        engines: res.searchEngines,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message || 'Ошибка запроса', loading: false });
    }
  },

  startPolling(ms = 5000) {
    const { _timer } = get();
    if (_timer) return;
    // сразу дернем
    get().fetch();
    const id = window.setInterval(() => {
      get().fetch();
    }, ms);
    set({ _timer: id });
  },

  stopPolling() {
    const { _timer } = get();
    if (_timer) {
      window.clearInterval(_timer);
      set({ _timer: undefined });
    }
  },

  setPeriod(p) {
    set({ period: p });
    get().fetch();
  },
  setEngine(e) {
    set({ engine: e || undefined });
    get().fetch();
  },
  setServer(s) {
    set({ server: s || undefined });
    get().fetch();
  },

  async fetchLatestSpeed() {
    try {
      const res = await fetchLatestSpeed();
      set({ latestSpeed: res });
    } catch (e) {
      console.error('Failed to fetch latest speed', e);
    }
  },
}));
