const BASE = process.env.NEXT_PUBLIC_API_BASE;

export interface TestBenchEngineConfig {
  id: number;
  engine: 'yandex' | 'google';
  autoblockEnabled: boolean;
  autoblockSelectors: boolean;
  autoblockPositionsJump: boolean;
  autoblockPositionsMissing: boolean;
  telegramAlertsEnabled: boolean;

  positionJumpDiffWarning: number;
  maxMissingPositionsPerRun: number;
  speedTestLimit: number;
  positionTestLimit: number;

  positionTestSite: string;

  blocked: boolean;
  blockReason: string | null;

  createdAt: string;
  updatedAt: string;

  /** CAPTCHA METRICS */

  captchaAlertsEnabled: boolean;

  captchaAvgNonZeroLimitDesktop: number;
  captchaAvgNonZeroLimitMobile: number;

  captchaAvgNonZeroMinDesktop: number;
  captchaAvgNonZeroMinMobile: number;

  captchaMinAvgAlertEnabled: boolean;

  captchaZeroPercentLimitDesktop: number;
  captchaZeroPercentLimitMobile: number;

  captchaScheduleTimes: string[];
}

export type TestBenchPhraseType = 'speed' | 'selector' | 'position';

export interface TestBenchPhrase {
  id: number;
  phrase: string;
  type: TestBenchPhraseType;
  active: boolean;
  searchEngine: 'yandex' | 'google' | null;
  tags: string[] | null;

  createdAt: string;
  updatedAt: string;
}

export interface UpdateConfigDto {
  autoblockEnabled?: boolean;
  autoblockSelectors?: boolean;
  autoblockPositionsJump?: boolean;
  autoblockPositionsMissing?: boolean;
  telegramAlertsEnabled?: boolean;

  positionJumpDiffWarning?: number;
  maxMissingPositionsPerRun?: number;
  speedTestLimit?: number;
  positionTestLimit?: number;

  positionTestSite?: string;

  // Captcha metrics
  captchaAlertsEnabled?: boolean;

  captchaAvgNonZeroLimitDesktop?: number;
  captchaAvgNonZeroLimitMobile?: number;

  captchaAvgNonZeroMinDesktop?: number;
  captchaAvgNonZeroMinMobile?: number;

  captchaMinAvgAlertEnabled?: boolean;

  captchaZeroPercentLimitDesktop?: number;
  captchaZeroPercentLimitMobile?: number;

  captchaScheduleTimes?: string[];
}

export interface PhraseQueryParams {
  type?: TestBenchPhraseType;
  searchEngine?: 'yandex' | 'google';
  active?: boolean;
  q?: string;
}

export interface CreatePhraseDto {
  phrase: string;
  type: TestBenchPhraseType;
  active: boolean;
  searchEngine: 'yandex' | 'google' | null;
  tags?: string[];
}

export type UpdatePhraseDto = Partial<CreatePhraseDto>;

export interface LoadPhrasesParams {
  type?: TestBenchPhraseType;
  searchEngine?: 'yandex' | 'google';
  active?: boolean;
  q?: string;
}

export interface TestBenchCaptchaMetric {
  id: number;
  serverId: string;
  engine: 'yandex' | 'google';
  device: 'desktop' | 'mobile';

  zeroCaptchaCount: number;
  avgTotal: number;
  avgNonZero: number;

  samplesTotal: number;
  samplesNonZero: number;

  zeroPercent: number;

  histogram: Record<string, number>;

  collectedAt: string;
  createdAt: string;
}

export interface FetchCaptchaHistoryParams {
  days?: number;
  serverId?: string;
}

export async function fetchJSON<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json() as Promise<T>;
}

export const fetchConfigs = () =>
  fetchJSON<TestBenchEngineConfig[]>(`${BASE}/admin/test-bench/config`);

export const fetchEngineConfig = (engine: 'yandex' | 'google') =>
  fetchJSON<TestBenchEngineConfig>(`${BASE}/admin/test-bench/config/${engine}`);

export const updateEngineConfig = (
  engine: 'yandex' | 'google',
  dto: UpdateConfigDto
) =>
  fetchJSON<TestBenchEngineConfig>(
    `${BASE}/admin/test-bench/config/${engine}`,
    {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }
  );

export const toggleEngineBlock = (
  engine: 'yandex' | 'google',
  value: boolean
) =>
  fetchJSON<TestBenchEngineConfig>(
    `${BASE}/admin/test-bench/config/${engine}/block/${value}`,
    {
      method: 'PATCH',
    }
  );

// Phrases
export const fetchPhrases = (params: PhraseQueryParams = {}) =>
  fetchJSON<{ items: TestBenchPhrase[] }>(
    `${BASE}/admin/test-bench/phrases?` +
      new URLSearchParams(params as Record<string, string>)
  );

export const createPhrase = (dto: CreatePhraseDto) =>
  fetchJSON<TestBenchPhrase>(`${BASE}/admin/test-bench/phrases`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });

export const updatePhrase = (id: number, dto: UpdatePhraseDto) =>
  fetchJSON<TestBenchPhrase>(`${BASE}/admin/test-bench/phrases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });

export const deletePhrase = (id: number) =>
  fetchJSON<{ success: true }>(`${BASE}/admin/test-bench/phrases/${id}`, {
    method: 'DELETE',
  });

export const fetchCaptchaMetricsHistory = (
  params: FetchCaptchaHistoryParams = {}
) =>
  fetchJSON<TestBenchCaptchaMetric[]>(
    `${BASE}/api/v1/admin/testbench/captcha/history?` +
      new URLSearchParams(params as Record<string, string>)
  );

export const runCaptchaMetricsReport = () =>
  fetchJSON<{ ok: true }>(`${BASE}/api/v1/admin/testbench/captcha/metrics`);

export const deleteCaptchaMetricsByServer = (serverId: string) =>
  fetchJSON<{ ok: true; deleted: number }>(
    `${BASE}/api/v1/admin/testbench/captcha/history/${encodeURIComponent(
      serverId
    )}`,
    {
      method: 'DELETE',
    }
  );
