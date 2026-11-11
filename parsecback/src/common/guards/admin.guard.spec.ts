import {
  INestApplication,
  UnauthorizedException,
  type Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AdminGuard } from './admin.guard';
import { JwtCookieGuard } from './jwt-cookie.guard';
import { AuthService } from '@/modules/auth/auth.service';
import { EconomyController } from '@/modules/economy/economy.controller';
import { EconomyService } from '@/modules/economy/economy.service';
import { TaskThroughputController } from '@/modules/task-stats/task-throughput.controller';
import { TaskThroughputService } from '@/modules/task-stats/task-throughput.service';
import { TaskStatsController } from '@/modules/task-stats/task-stats.controller';
import { TaskStatsCron } from '@/modules/task-stats/task-stats.cron';
import { TestBenchController } from '@/modules/test-bench/test-bench.controller';
import { TestBenchService } from '@/modules/test-bench/test-bench.service';
import { TestBenchCaptchaService } from '@/modules/test-bench/test-bench-captcha.service';
import { TestBenchEngineConfigController } from '@/modules/test-bench/test-bench-engine-config.controller';
import { TestBenchEngineConfigService } from '@/modules/test-bench/test-bench-engine-config.service';
import { TestBenchPhrasesAdminController } from '@/modules/test-bench/test-bench-phrases-admin.controller';
import { TestBenchPhrasesAdminService } from '@/modules/test-bench/test-bench-phrases-admin.service';
import { ReferralController } from '@/modules/referral/referral.controller';
import { ReferralService } from '@/modules/referral/referral.service';

type Method = 'get' | 'post' | 'patch' | 'delete';
const routes: [Method, string][] = [
  ['get', '/admin/economy/topup-clients'],
  ['get', '/admin/economy/revenue-services'],
  ['get', '/admin/economy/topups-month-weeks'],
  ['get', '/admin/economy/registrations'],
  ['get', '/api/v1/admin/throughput'],
  ['get', '/api/v1/admin/throughput/rebuild'],
  ['delete', '/api/v1/admin/throughput?server=fixture&engine=yandex'],
  ['get', '/task-stats/recalculate-stats'],
  ['get', '/admin/test-bench/config'],
  ['get', '/admin/test-bench/config/yandex'],
  ['patch', '/admin/test-bench/config/yandex'],
  ['get', '/admin/test-bench/config/yandex/block'],
  ['patch', '/admin/test-bench/config/yandex/block/true'],
  ['get', '/admin/test-bench/phrases'],
  ['get', '/admin/test-bench/phrases/1'],
  ['post', '/admin/test-bench/phrases'],
  ['patch', '/admin/test-bench/phrases/1'],
  ['delete', '/admin/test-bench/phrases/1'],
  ['get', '/api/v1/admin/testbench/runs'],
  ['get', '/api/v1/admin/testbench/latest-speed'],
  ['get', '/api/v1/admin/testbench/run'],
  ['get', '/api/v1/admin/testbench/checks'],
  ['get', '/api/v1/admin/testbench/positions-summary'],
  ['post', '/api/v1/admin/testbench/selectors/report'],
  ['get', '/api/v1/admin/testbench/selectors/runs'],
  ['get', '/api/v1/admin/testbench/positions'],
  ['get', '/api/v1/admin/testbench/captcha/metrics'],
  ['get', '/api/v1/admin/testbench/captcha/history'],
  ['delete', '/api/v1/admin/testbench/captcha/history/fixture'],
  ['get', '/referral/generate-codes'],
];

const dependencies: { provide: Type<unknown>; methods: string[] }[] = [
  {
    provide: EconomyService,
    methods: [
      'getMonthlyTopupClients',
      'getMonthlyServiceRevenue',
      'getMonthlyTopupsWithWeeks',
      'getMonthlyRegistrations',
    ],
  },
  {
    provide: TaskThroughputService,
    methods: ['getRecords', 'rebuildRecords', 'deleteServerEngineStats'],
  },
  { provide: TaskStatsCron, methods: ['aggregateAllForTest'] },
  {
    provide: TestBenchService,
    methods: [
      'getRuns',
      'getLatestSpeeds',
      'runAll',
      'getChecks',
      'getPositionSummary',
      'saveSelectorReport',
      'getSelectorRuns',
      'getPositions',
      'sendCaptchaMetricsReport',
    ],
  },
  {
    provide: TestBenchCaptchaService,
    methods: ['getMetrics', 'deleteMetricsByServer'],
  },
  {
    provide: TestBenchEngineConfigService,
    methods: ['getFullList', 'getFullConfig', 'update', 'getBlock', 'setBlock'],
  },
  {
    provide: TestBenchPhrasesAdminService,
    methods: ['list', 'getOne', 'create', 'update', 'remove'],
  },
  {
    provide: ReferralService,
    methods: ['createCodeForAllUsers', 'validateCode'],
  },
];

describe('Admin authorization across every newly protected handler', () => {
  let app: INestApplication;
  const mocks: jest.Mock[] = [];

  beforeAll(async () => {
    const services = dependencies.map(({ provide, methods }) => {
      const useValue: Record<string, jest.Mock> = {};
      for (const name of methods) {
        useValue[name] = jest.fn().mockResolvedValue([]);
        mocks.push(useValue[name]);
      }
      if (provide === ReferralService)
        useValue.validateCode.mockResolvedValue(true);
      return { provide, useValue };
    });
    const module = await Test.createTestingModule({
      controllers: [
        EconomyController,
        TaskThroughputController,
        TaskStatsController,
        TestBenchController,
        TestBenchEngineConfigController,
        TestBenchPhrasesAdminController,
        ReferralController,
      ],
      providers: [
        ...services,
        AdminGuard,
        JwtCookieGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({ COOKIE_NAME: 'psk.sid' }),
        },
        {
          provide: AuthService,
          useValue: {
            verifyToken: (token: string) => {
              const id = {
                admin: 1,
                user: 2,
                deleted: 3,
                support: 4,
                malformed: 5,
              }[token];
              if (!id) throw new UnauthorizedException('invalid_token');
              return { sub: id };
            },
            findUserById: (id: number) =>
              Promise.resolve(
                id === 3
                  ? null
                  : {
                      id,
                      role:
                        id === 1
                          ? ['admin']
                          : id === 4
                            ? ['support']
                            : id === 5
                              ? 'superadmin'
                              : ['user'],
                    },
              ),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  it.each(routes)(
    '%s %s denies anonymous requests before service calls',
    async (method, path) => {
      await request(app.getHttpServer() as Server)
        [method](path)
        .send({})
        .expect(401);
      for (const mock of mocks) expect(mock).not.toHaveBeenCalled();
    },
  );

  it.each(routes)(
    '%s %s denies ordinary users before service calls',
    async (method, path) => {
      await request(app.getHttpServer() as Server)
        [method](path)
        .set('Cookie', 'psk.sid=user')
        .send({})
        .expect(403);
      for (const mock of mocks) expect(mock).not.toHaveBeenCalled();
    },
  );

  it.each(routes)('%s %s allows an administrator', async (method, path) => {
    const result = await request(app.getHttpServer() as Server)
      [method](path)
      .set('Cookie', 'psk.sid=admin')
      .send({});
    expect([200, 201]).toContain(result.status);
    expect(mocks.some((mock) => mock.mock.calls.length > 0)).toBe(true);
  });

  it.each([
    ['invalid', 401],
    ['deleted', 401],
    ['support', 403],
    ['malformed', 403],
  ] as const)('rejects %s sessions', async (cookie, status) => {
    await request(app.getHttpServer() as Server)
      .get('/admin/economy/registrations')
      .set('Cookie', `psk.sid=${cookie}`)
      .expect(status);
    for (const mock of mocks) expect(mock).not.toHaveBeenCalled();
  });

  it('keeps referral validation public for registration', async () => {
    await request(app.getHttpServer() as Server)
      .get('/referral/validate/code')
      .expect(200, { valid: true });
  });
});
