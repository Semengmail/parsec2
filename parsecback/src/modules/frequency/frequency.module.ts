// src/modules/frequency/frequency.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FrequencyTask } from './entities/frequency-task.entity';
import { FrequencyChunk } from './entities/frequency-chunk.entity';
import { FrequencyService } from './frequency.service';
import { FrequencyController } from './frequency.controller';
import { KeyTurboClient } from './keyturbo.client';
import { BillingModule } from '@/modules/billing/billing.module';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FrequencyTask, FrequencyChunk]),
    BillingModule,
    UsersModule,
    ServicesModule,
  ],
  providers: [FrequencyService, KeyTurboClient],
  controllers: [FrequencyController],
  exports: [FrequencyService],
})
export class FrequencyModule {}
