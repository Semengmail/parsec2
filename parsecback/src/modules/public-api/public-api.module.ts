import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '@/modules/users/users.module';
import { BillingModule } from '@/modules/billing/billing.module';

import { PublicApiKeyGuard } from '@/common/guards/public-api-key.guard';
import { PublicXmlExceptionFilter } from '@/common/filters/public-xml-exception.filter';

import { RankScanClient } from './rankscan.client';

// ── Yandex
import { YandexLiveTask } from './entities/yandexlive-task.entity';
import { YandexLiveService } from './yandexlive.service';
import { YandexLiveWorker } from './yandexlive.worker';
import { YandexLiveCleanupService } from './yandexlive.cleanup';
import { YandexLiveController } from './yandexlive.controller';
import { YandexLiveCompatController } from './yandexlive.compat.controller';

// ── Google
import { GoogleLiveTask } from './entities/googlelive-task.entity';
import { GoogleLiveService } from './googlelive.service';
import { GoogleLiveWorker } from './googlelive.worker';
import { GoogleLiveCleanupService } from './googlelive.cleanup';
import { GoogleLiveController } from './googlelive.controller';
import { GoogleLiveCompatController } from './googlelive.compat.controller';
import { GoogleCityCoords } from './entities/google-city-coords';
import { GoogleLiveCatalogController } from './googlelive.catalog.controller';
import { GoogleGeoTarget } from './entities/google-geo-target.entity';
import { LimitsModule } from '@/common/limits/limits.module';
import { TaskStatsModule } from '../task-stats/task-stats.module';
import { ServicesModule } from '../services/services.module';
import { EngineBlockService } from './engine-block.service';
import { PublicApiPauseService } from './public-api-pause.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      YandexLiveTask,
      GoogleLiveTask,
      GoogleCityCoords,
      GoogleGeoTarget,
    ]),
    UsersModule,
    BillingModule,
    TaskStatsModule,
    ServicesModule,
    LimitsModule,
  ],
  providers: [
    PublicApiKeyGuard,
    PublicXmlExceptionFilter,

    RankScanClient,

    // Yandex
    YandexLiveService,
    YandexLiveWorker,
    YandexLiveCleanupService,

    // Google
    GoogleLiveService,
    GoogleLiveWorker,
    GoogleLiveCleanupService,

    EngineBlockService,
    PublicApiPauseService,
  ],
  controllers: [
    // Yandex
    YandexLiveController,
    YandexLiveCompatController,

    // Google
    GoogleLiveController,
    GoogleLiveCompatController,
    GoogleLiveCatalogController,
  ],
  exports: [
    TypeOrmModule,
    RankScanClient,
    YandexLiveService,
    GoogleLiveService,
    PublicApiPauseService,
  ],
})
export class PublicApiModule {}
