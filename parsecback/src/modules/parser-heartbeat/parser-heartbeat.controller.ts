// src/modules/parser-heartbeat/parser-heartbeat.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ParserHeartbeatService } from './parser-heartbeat.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('parser-heartbeat')
export class ParserHeartbeatController {
  constructor(private readonly service: ParserHeartbeatService) {}

  @Get()
  async heartbeatGet(@Query() dto: HeartbeatDto) {
    await this.service.receiveHeartbeat(dto.parser, dto.server);
    return { status: 'ok' };
  }
  @Post()
  async heartbeat(@Body() dto: HeartbeatDto) {
    await this.service.receiveHeartbeat(dto.parser, dto.server);
    return { status: 'ok' };
  }
}
