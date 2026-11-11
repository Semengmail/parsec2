// src/entities/admin/model/use-testbench-positions-store.ts
import { create } from 'zustand';
import {
  fetchTestBenchPositionSummary,
  fetchTestBenchPositions,
  type PositionSummaryRow,
  type TestBenchPositionRow,
} from '@/entities/admin/api/admin-api';

export type Engine = 'yandex' | 'google';

type SummaryAll = {
  yandex: PositionSummaryRow[] | null;
  google: PositionSummaryRow[] | null;
};

type State = {
  engine: Engine;

  // Данные выбранного движка (для PositionsPanel: график + таблица)
  summary: PositionSummaryRow[] | null;
  rows: TestBenchPositionRow[] | null;

  // Данные по обоим движкам (для SummaryPanel)
  summaryAll: SummaryAll | null;
  rowsAll: TestBenchPositionRow[] | null;

  loading: boolean;
  error: string | null;
};

type Actions = {
  setEngine: (engine: Engine) => void;
  fetch: (days?: number) => Promise<void>;
  fetchAll: (days?: number) => Promise<void>;
};

export const useTestBenchPositionsStore = create<State & Actions>(
  (set, get) => ({
    engine: 'yandex',

    summary: null,
    rows: null,

    summaryAll: null,
    rowsAll: null,

    loading: false,
    error: null,

    setEngine(engine) {
      set({ engine });
    },

    // 👇 как и раньше: грузим ТОЛЬКО текущий движок
    async fetch(days = 5) {
      const { engine } = get();
      set({ loading: true, error: null });

      try {
        const [summary, rows] = await Promise.all([
          fetchTestBenchPositionSummary({ engine, days }),
          fetchTestBenchPositions({ engine, days }),
        ]);

        set({
          summary,
          rows,
          loading: false,
        });
      } catch (e) {
        set({
          error: (e as Error).message ?? 'Ошибка загрузки позиций',
          loading: false,
        });
      }
    },

    // 👇 отдельная загрузка ОБОИХ движков — ничего старое не ломает
    async fetchAll(days = 5) {
      try {
        const [yaSummary, yaRows] = await Promise.all([
          fetchTestBenchPositionSummary({ engine: 'yandex', days }),
          fetchTestBenchPositions({ engine: 'yandex', days }),
        ]);

        const [goSummary, goRows] = await Promise.all([
          fetchTestBenchPositionSummary({ engine: 'google', days }),
          fetchTestBenchPositions({ engine: 'google', days }),
        ]);

        set({
          summaryAll: {
            yandex: yaSummary,
            google: goSummary,
          },
          rowsAll: [...yaRows, ...goRows],
        });
      } catch (e) {
        // Ошибку для all можно не выводить в UI, чтобы не мешать PositionsPanel
        set((prev) => ({
          ...prev,
          error: (e as Error).message ?? prev.error,
        }));
      }
    },
  })
);
