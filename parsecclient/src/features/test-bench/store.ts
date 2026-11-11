import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  TestBenchEngineConfig,
  TestBenchPhrase,
  CreatePhraseDto,
  UpdatePhraseDto,
  fetchConfigs,
  updateEngineConfig,
  toggleEngineBlock,
  createPhrase,
  deletePhrase,
  fetchPhrases,
  updatePhrase,
  LoadPhrasesParams,
  fetchCaptchaMetricsHistory,
  TestBenchCaptchaMetric,
  FetchCaptchaHistoryParams,
  runCaptchaMetricsReport,
  deleteCaptchaMetricsByServer,
} from './api';

export interface TestBenchState {
  configs: Record<'yandex' | 'google', TestBenchEngineConfig> | null;
  phrases: TestBenchPhrase[];
  loading: boolean;
  error: string | null;

  loadConfigs: () => Promise<void>;
  saveConfig: (
    engine: 'yandex' | 'google',
    dto: Partial<TestBenchEngineConfig>
  ) => Promise<void>;
  setBlock: (engine: 'yandex' | 'google', value: boolean) => Promise<void>;

  loadPhrases: (params?: LoadPhrasesParams) => Promise<void>;
  addPhrase: (dto: CreatePhraseDto) => Promise<void>;
  editPhrase: (id: number, dto: UpdatePhraseDto) => Promise<void>;
  removePhrase: (id: number) => Promise<void>;
}

export interface TestBenchState {
  configs: Record<'yandex' | 'google', TestBenchEngineConfig> | null;
  phrases: TestBenchPhrase[];
  captchaHistory: TestBenchCaptchaMetric[] | null;

  loading: boolean;
  error: string | null;

  loadConfigs: () => Promise<void>;
  saveConfig: (
    engine: 'yandex' | 'google',
    dto: Partial<TestBenchEngineConfig>
  ) => Promise<void>;
  setBlock: (engine: 'yandex' | 'google', value: boolean) => Promise<void>;

  loadPhrases: (params?: LoadPhrasesParams) => Promise<void>;
  addPhrase: (dto: CreatePhraseDto) => Promise<void>;
  editPhrase: (id: number, dto: UpdatePhraseDto) => Promise<void>;
  removePhrase: (id: number) => Promise<void>;

  loadCaptchaHistory: (params?: FetchCaptchaHistoryParams) => Promise<void>; // ← добавили типизацию
  runCaptchaMetricsReport: () => Promise<void>;
  removeCaptchaMetricsByServer: (serverId: string) => Promise<void>;
}

export const useTestBenchStore = create<TestBenchState>()(
  devtools((set, get) => ({
    configs: null,
    phrases: [],
    captchaHistory: null,
    loading: false,
    error: null,

    /** ──────────────────────────────────────────────
     * Загружаем конфиги всех движков
     * ──────────────────────────────────────────────*/
    loadConfigs: async () => {
      set({ loading: true, error: null });

      try {
        const configs = await fetchConfigs();

        // строгая структура
        const map: Record<'yandex' | 'google', TestBenchEngineConfig> = {
          yandex: configs.find((c) => c.engine === 'yandex')!,
          google: configs.find((c) => c.engine === 'google')!,
        };

        set({ configs: map });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error in loadConfigs';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },

    /** ──────────────────────────────────────────────
     * Сохранить конфиг конкретного движка
     * ──────────────────────────────────────────────*/
    saveConfig: async (engine, dto) => {
      await updateEngineConfig(engine, dto);
      await get().loadConfigs();
    },

    /** ──────────────────────────────────────────────
     * Блокировка движка
     * ──────────────────────────────────────────────*/
    setBlock: async (engine, value) => {
      await toggleEngineBlock(engine, value);
      await get().loadConfigs();
    },

    /** ──────────────────────────────────────────────
     * Загрузить фразы (с фильтрами)
     * ──────────────────────────────────────────────*/
    loadPhrases: async (params?: LoadPhrasesParams) => {
      set({ loading: true, error: null });

      try {
        const { items } = await fetchPhrases(params ?? {});
        set({ phrases: items });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error in loadPhrases';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },

    /** ──────────────────────────────────────────────
     * Создать фразу
     * ──────────────────────────────────────────────*/
    addPhrase: async (dto) => {
      await createPhrase(dto);
      await get().loadPhrases();
    },

    /** ──────────────────────────────────────────────
     * Редактировать фразу
     * ──────────────────────────────────────────────*/
    editPhrase: async (id, dto) => {
      await updatePhrase(id, dto);
      await get().loadPhrases();
    },

    /** ──────────────────────────────────────────────
     * Удалить фразу
     * ──────────────────────────────────────────────*/
    removePhrase: async (id) => {
      await deletePhrase(id);
      await get().loadPhrases();
    },

    loadCaptchaHistory: async (params?: FetchCaptchaHistoryParams) => {
      set({ loading: true, error: null });
      try {
        const data = await fetchCaptchaMetricsHistory(params);
        set({ captchaHistory: data });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unknown error in loadCaptchaHistory';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },

    runCaptchaMetricsReport: async () => {
      set({ loading: true, error: null });
      try {
        await runCaptchaMetricsReport();
        await get().loadCaptchaHistory({ days: 30 });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unknown error in runCaptchaMetricsReport';
        set({ error: message });
        throw err;
      } finally {
        set({ loading: false });
      }
    },

    removeCaptchaMetricsByServer: async (serverId: string) => {
      set({ loading: true, error: null });
      try {
        await deleteCaptchaMetricsByServer(serverId);
        await get().loadCaptchaHistory({ days: 30 });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unknown error in removeCaptchaMetricsByServer';
        set({ error: message });
        throw err;
      } finally {
        set({ loading: false });
      }
    },
  }))
);
