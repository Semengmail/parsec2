import { apiRoutes } from "@/shared/api/apiRoutes";
import { apiFetch } from "@/shared/lib/api/api-fetch";

export type EngineStats = {
  queued: number;
  sending: number;
  sent: number;
  polling: number;
  completed_unfetched: number;
  error: number;
  inflight: number;
};

export type AdminQueueStats = {
  total: EngineStats;
  byEngine: {
    yandexlive: EngineStats;
    googlelive: EngineStats;
  };
  limits: {
    globalMax: number;
    yandexliveCap: number;
    googleliveCap: number;
    currentInFlightTotal: number;
    available: number;
  };
};

export type TestBenchCheckLevel = "info" | "warning" | "error";
export type TestBenchCheckType =
  | "positions_timeout"
  | "position_site_missing"
  | "position_jump"
  | "selectors_no_results"
  | "selectors_has_results"
  | "selectors_url_selector_bad"
  | string;

export type TestBenchCheck = {
  id: number;
  engine: "yandex" | "google";
  device: "desktop" | "mobile";
  type: TestBenchCheckType;
  ok: boolean;
  level: TestBenchCheckLevel;
  message: string;
  phraseId: number | null;
  phraseText: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
};

export type TestBenchPositionRow = {
  id: number;
  engine: "yandex" | "google";
  device: "desktop" | "mobile";
  collectedAt: string;
  phraseId: number;
  phraseText: string;
  site: string;
  position: number | null;
};

export type TestBenchSelectorRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  yandexNoResOk: boolean | null;
  yandexHasResOk: boolean | null;
  googleNoResOk: boolean | null;
  googleHasResOk: boolean | null;
  completed: boolean;
  error: string | null;
};

export async function apiGetAdminStatus(): Promise<AdminQueueStats> {
  return apiFetch<AdminQueueStats>(apiRoutes.admin.status);
}

export type QueueEngineMetric = {
  queued: number;
  inFlight: number;
  sending: number;
  sent: number;
  polling: number;
  completedUnfetched: number;
  error: number;
  desktop: {
    queued: number;
    inFlight: number;
  };
  mobile: {
    queued: number;
    inFlight: number;
  };
};

export type QueueMinuteSample = {
  ts: string;
  total: QueueEngineMetric & {
    capacity: number;
    available: number;
    saturationPct: number;
    overload: number;
    pressurePct: number;
  };
  byEngine: {
    yandexlive: QueueEngineMetric;
    googlelive: QueueEngineMetric;
  };
  throughputPagesPerMinute: {
    total: number;
    byEngine: {
      yandexlive: {
        total: number;
        desktop: number;
        mobile: number;
      };
      googlelive: {
        total: number;
        desktop: number;
        mobile: number;
      };
    };
  };
};

export type QueueHourBucket = {
  ts: string;
  samples: number;
  queuedAvg: number;
  queuedMax: number;
  inFlightAvg: number;
  inFlightMax: number;
  saturationAvg: number;
  saturationMax: number;
  overloadAvg: number;
  overloadMax: number;
  yandexQueuedMax: number;
  googleQueuedMax: number;
  throughputPagesAvg: number;
  throughputPagesMax: number;
  yandexThroughputPagesMax: number;
  googleThroughputPagesMax: number;
  yandexDesktopThroughputPagesMax: number;
  yandexMobileThroughputPagesMax: number;
  googleDesktopThroughputPagesMax: number;
  googleMobileThroughputPagesMax: number;
};

export type QueueDayBucket = {
  date: string;
  weekday: string;
  samples: number;
  queuedAvg: number;
  queuedMax: number;
  inFlightAvg: number;
  inFlightMax: number;
  saturationMax: number;
  overloadMax: number;
  throughputPagesAvg: number;
  throughputPagesMax: number;
};

export type QueueAnalyticsResponse = {
  current: QueueMinuteSample | null;
  realtime: QueueMinuteSample[];
  hourly: QueueHourBucket[];
  daily: QueueDayBucket[];
  summary: {
    state: "idle" | "normal" | "busy" | "overloaded";
    message: string;
    overloadMinutesLastHour: number;
    scaleSignal: boolean;
    devicePressure: "desktop" | "mobile" | "balanced" | null;
    peakHour: QueueHourBucket | null;
    worstEngine: "yandexlive" | "googlelive" | "balanced" | null;
  };
};

export async function apiGetQueueAnalytics(): Promise<QueueAnalyticsResponse> {
  return apiFetch<QueueAnalyticsResponse>(apiRoutes.admin.queueAnalytics);
}

export type ServiceLimitSettings = {
  userRequestLimit: number;
  adminRequestLimit: number;
};

export type AdminGlobalSettings = {
  globalMaxInFlight: number;
  maxQueuedPerEngine: number;
  services: {
    yandexLive: ServiceLimitSettings;
    googleLive: ServiceLimitSettings;
    yandexXml: ServiceLimitSettings;
    frequency: ServiceLimitSettings;
  };
};

export async function apiGetAdminSettings(): Promise<AdminGlobalSettings> {
  return apiFetch<AdminGlobalSettings>(apiRoutes.admin.settings);
}

export async function apiUpdateAdminSettings(
  payload: AdminGlobalSettings,
): Promise<AdminGlobalSettings> {
  return apiFetch<AdminGlobalSettings>(apiRoutes.admin.settings, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type AdminUser = {
  id: number;
  name: string | null;
  email: string;
  balance: string;
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchAdminUsers(params: {
  page: number;
  search?: string;
}): Promise<AdminUsersResponse> {
  const query = new URLSearchParams({ page: String(params.page), limit: "300" });
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiFetch<AdminUsersResponse>(apiRoutes.admin.users(query));
}

export async function clearAdminUserBalance(id: number): Promise<{
  id: number;
  email: string;
  previousBalance: string;
  balance: string;
}> {
  return apiFetch(apiRoutes.admin.clearUserBalance(id), { method: "DELETE" });
}

export type TaskStatsPeriod = "hour" | "day" | "week" | "month";

export type AggregatedRow = {
  periodStart: string; // ISO
  searchEngine: string;
  server: string;
  totalPages: number;
  avgDurationSec: number;
  pagesPerSec: number;
};

export type GetTaskStatsResponse = {
  data: AggregatedRow[];
  servers: string[];
  searchEngines: string[];
};

export async function fetchTaskStats(params: {
  period: TaskStatsPeriod;
  engine?: string;
  server?: string;
  signal?: AbortSignal;
}): Promise<GetTaskStatsResponse> {
  const query = new URLSearchParams({ period: params.period });
  if (params.engine) query.set("engine", params.engine);
  if (params.server) query.set("server", params.server);

  // ✅ используем общий apiFetch с типом
  return apiFetch<GetTaskStatsResponse>(apiRoutes.admin.stats(query), {
    signal: params.signal,
  });
}

export type LatestSpeedResponse = {
  yandex: number | null;
  google: number | null;
};

/** Получение последних измеренных скоростей тестового стенда (стр/мин) */
export async function fetchLatestSpeed(): Promise<LatestSpeedResponse> {
  return apiFetch<LatestSpeedResponse>(apiRoutes.admin.lastedSpeed);
}

export type TestBenchRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  engine: "yandex" | "google";
  durationMs: string | null;
  pagesPerMinute: number | null;
  totalPages: number;
};

export async function fetchTestBenchRuns(
  limit = 200,
  engine: "all" | "yandex" | "google" = "all",
): Promise<TestBenchRun[]> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  query.set("engine", engine);
  return apiFetch<TestBenchRun[]>(apiRoutes.admin.testBenchRuns(query));
}

/** Чеки тест-бенча */
export async function fetchTestBenchChecks(params: {
  engine?: "all" | "yandex" | "google";
  days?: number;
}): Promise<TestBenchCheck[]> {
  const query = new URLSearchParams();
  if (params.engine) query.set("engine", params.engine);
  if (params.days) query.set("days", String(params.days));

  return apiFetch<TestBenchCheck[]>(apiRoutes.admin.testBenchChecks(query));
}

/** Агрегация по позициям */
export type PositionSummaryRow = {
  ts: string;
  samples: number;
  missing: number;
  avgPosition: number | null;
};

export async function fetchTestBenchPositionSummary(params: {
  engine: "yandex" | "google";
  days?: number;
}): Promise<PositionSummaryRow[]> {
  const query = new URLSearchParams();
  query.set("engine", params.engine);
  if (params.days) query.set("days", String(params.days));

  return apiFetch<PositionSummaryRow[]>(
    apiRoutes.admin.testBenchPositionsSummary(query),
  );
}

/** Сырые позиции по фразам */
export async function fetchTestBenchPositions(params: {
  engine: "yandex" | "google";
  days?: number;
}): Promise<TestBenchPositionRow[]> {
  const query = new URLSearchParams();
  query.set("engine", params.engine);
  if (params.days) query.set("days", String(params.days));

  return apiFetch<TestBenchPositionRow[]>(
    apiRoutes.admin.testBenchPositions(query),
  );
}

/** История селектор-ранов */
export async function fetchTestBenchSelectorRuns(
  limit = 100,
): Promise<TestBenchSelectorRun[]> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  return apiFetch<TestBenchSelectorRun[]>(
    apiRoutes.admin.testBenchSelectorRuns(query),
  );
}

export type ThroughputPeriod = "all_time" | "day" | "week" | "month";

export type ThroughputRecord = {
  server: string;
  searchEngine: string;
  period: ThroughputPeriod;
  hour: string;
  pagesPerSec: number;
  totalPages: number;
  activeMinutes: number;
};

// Получение записей по максимальной производительности
export async function fetchThroughputRecords(params?: {
  server?: string;
  engine?: string;
}): Promise<ThroughputRecord[]> {
  const q = new URLSearchParams();
  if (params?.server) q.set("server", params.server);
  if (params?.engine) q.set("engine", params.engine);

  return apiFetch<ThroughputRecord[]>(apiRoutes.admin.throughput(q));
}

export type RebuildThroughputResponse = {
  ok: true;
  days: number;
};

export type DeleteThroughputStatsResponse = {
  ok: true;
  recordsDeleted: number;
  hoursDeleted: number;
  rawDeleted: number;
};

export async function rebuildThroughput(
  days = 14,
): Promise<RebuildThroughputResponse> {
  const query = new URLSearchParams();
  query.set("days", String(days));

  return apiFetch<RebuildThroughputResponse>(
    apiRoutes.admin.throughputRebuild(query),
  );
}

export async function deleteThroughputStats(params: {
  server: string;
  engine: string;
}): Promise<DeleteThroughputStatsResponse> {
  const query = new URLSearchParams();
  query.set("server", params.server);
  query.set("engine", params.engine);

  return apiFetch<DeleteThroughputStatsResponse>(
    apiRoutes.admin.throughputDelete(query),
    { method: "DELETE" },
  );
}
