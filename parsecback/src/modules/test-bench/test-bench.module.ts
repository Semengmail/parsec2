import { AuthModule } from '../auth/auth.module';
// src/modules/test-bench/test-bench.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TestBenchPhrase } from './entities/test-bench-phrase.entity';
import { TestBenchRun } from './entities/test-bench-run.entity';
import { TestBenchService } from './test-bench.service';
import { TestBenchController } from './test-bench.controller';
import { PublicApiModule } from '../public-api/public-api.module';
import { TestBenchCheck } from './entities/test-bench-check.entity';
import { TestBenchPosition } from './entities/test-bench-position.entity';
import { TestBenchSelectorRun } from './entities/test-bench-selector-runs.entity';
import { TestBenchEngineBlock } from './entities/test-bench-engine-block.entity';
import { TestBenchEngineConfig } from './entities/test-bench-engine-config.entity';
import { TestBenchEngineConfigService } from './test-bench-engine-config.service';
import { TestBenchPhrasesAdminService } from './test-bench-phrases-admin.service';
import { TestBenchEngineConfigController } from './test-bench-engine-config.controller';
import { TestBenchPhrasesAdminController } from './test-bench-phrases-admin.controller';
import { RankScanLockClient } from './rankscan-lock.client';
import { TestBenchCaptchaService } from './test-bench-captcha.service';
import { TestBenchCaptchaMetric } from './entities/test-bench-captcha-metric.entity';
import { AlertingModule } from '@/shared/alerting/alerting.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      TestBenchPhrase,
      TestBenchRun,
      TestBenchCheck,
      TestBenchPosition,
      TestBenchSelectorRun,
      TestBenchEngineBlock,
      TestBenchEngineConfig,
      TestBenchCaptchaMetric,
    ]),
    PublicApiModule,
    AlertingModule,
  ],
  providers: [
    TestBenchService,
    TestBenchEngineConfigService,
    TestBenchPhrasesAdminService,
    RankScanLockClient,
    TestBenchCaptchaService,
  ],
  controllers: [
    TestBenchController,
    TestBenchEngineConfigController,
    TestBenchPhrasesAdminController,
  ],
  exports: [TestBenchService, TestBenchEngineConfigService],
})
export class TestBenchModule {}
