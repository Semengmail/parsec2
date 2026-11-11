export const apiRoutes = {
  admin: {
    status: "/api/v1/admin/status",
    queueAnalytics: "/api/v1/admin/queue-analytics",
    settings: "/api/v1/admin/settings",
    stats: (query: URLSearchParams) =>
      `/api/v1/admin/stats?${query.toString()}`,
    lastedSpeed: "/api/v1/admin/testbench/latest-speed",
    testBenchRuns: (query: URLSearchParams) =>
      `/api/v1/admin/testbench/runs?${query.toString()}`,

    testBenchChecks: (q: URLSearchParams) =>
      `/api/v1/admin/testbench/checks?${q.toString()}`,
    testBenchPositionsSummary: (q: URLSearchParams) =>
      `/api/v1/admin/testbench/positions-summary?${q.toString()}`,
    testBenchPositions: (q: URLSearchParams) =>
      `/api/v1/admin/testbench/positions?${q.toString()}`,
    testBenchSelectorRuns: (q: URLSearchParams) =>
      `/api/v1/admin/testbench/selectors/runs?${q.toString()}`,

    throughput: (q?: URLSearchParams) =>
      `/api/v1/admin/throughput${q && q.toString() ? `?${q.toString()}` : ""}`,

    throughputRebuild: (q: URLSearchParams) =>
      `/api/v1/admin/throughput/rebuild?${q.toString()}`,

    throughputDelete: (q: URLSearchParams) =>
      `/api/v1/admin/throughput?${q.toString()}`,

    economyTopupClients: (q: URLSearchParams) =>
      `/admin/economy/topup-clients?${q.toString()}`,

    economyRevenueServices: (q: URLSearchParams) =>
      `/admin/economy/revenue-services?${q.toString()}`,

    economyTopupsMonthWeeks: (q: URLSearchParams) =>
      `/admin/economy/topups-month-weeks?${q.toString()}`,

    economyRegistrations: (q: URLSearchParams) =>
      `/admin/economy/registrations?${q.toString()}`,

    users: (q: URLSearchParams) => `/api/v1/admin/users?${q.toString()}`,
    clearUserBalance: (id: number) => `/api/v1/admin/users/${id}/balance`,
  },
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
  },
  balance: {
    getMyBalance: "/users/me/balance",
  },
  users: {
    rotateMyApiKey: "/users/me/api-key/rotate",
  },
  dashboard: {
    summary: "/dashboard/summary",
  },
  payment: {
    create: "/payment/create",
  },
  billing: {
    partnerReport: "/billing/partner/report",
    adminReport: "/billing/admin/report",
    adminSoftIds: "/billing/admin/soft-ids",
  },
};
