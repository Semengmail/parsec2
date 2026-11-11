import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GlobalLimitsSettings } from './entities/global-limits-settings.entity';
import { LimitsService } from './limits.service';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalLimitsSettings])],
  providers: [LimitsService],
  exports: [LimitsService],
})
export class LimitsModule {}
