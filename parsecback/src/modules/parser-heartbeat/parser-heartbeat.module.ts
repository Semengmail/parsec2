// src/modules/parser-heartbeat/parser-heartbeat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParserHeartbeat } from './entities/parser-heartbeat.entity';
import { ParserHeartbeatService } from './parser-heartbeat.service';
import { ParserHeartbeatController } from './parser-heartbeat.controller';
import { AlertingModule } from '@/shared/alerting/alerting.module';

@Module({
  imports: [TypeOrmModule.forFeature([ParserHeartbeat]), AlertingModule],
  controllers: [ParserHeartbeatController],
  providers: [ParserHeartbeatService],
  exports: [ParserHeartbeatService],
})
export class ParserHeartbeatModule {}
