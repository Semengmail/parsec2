import { fetchConfigs } from '@/features/test-bench/api';
import { create } from 'zustand';

export interface TestBenchEngineConfig {
  engine: 'yandex' | 'google';
  autoblockEnabled: boolean;
  autoblockSelectors: boolean;
  autoblockPositionsJump: boolean;
  autoblockPositionsMissing: boolean;
  telegramAlertsEnabled: boolean;
  positionJumpDiffWarning: number;
  maxMissingPositionsPerRun: number;
  positionTestSite: string;
  positionTestLimit: number;
  speedTestLimit: number;
}

interface State {
  configs: TestBenchEngineConfig[] | null;
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useTestBenchConfigStore = create<State>((set) => ({
  configs: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await fetchConfigs();
      set({ configs: res, loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
}));
