import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServiceSettings } from './entities/service-settings.entity';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServiceSlugPipe } from './pipes/service-slug.pipe';
import { UrlPreviewService } from './url-preview.service';
import { TariffsModule } from '../tariffs/tariffs.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PublicInfoController } from './public-info.controller';
import { PublicInfoService } from './public-info.service';
import { LimitsModule } from '@/common/limits/limits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceSettings]),
    TariffsModule,
    UsersModule,
    AuthModule,
    LimitsModule,
  ],
  providers: [
    ServicesService,
    ServiceSlugPipe,
    UrlPreviewService,
    PublicInfoService,
  ],
  controllers: [ServicesController, PublicInfoController],
  exports: [ServicesService],
})
export class ServicesModule {}
