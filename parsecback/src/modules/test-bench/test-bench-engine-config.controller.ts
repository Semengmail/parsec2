import { AdminGuard } from '@/common/guards/admin.guard';
// src/modules/test-bench/test-bench-engine-config.controller.ts
import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  ParseBoolPipe,
  UseGuards,
} from '@nestjs/common';

import { TestBenchEngineConfigService } from './test-bench-engine-config.service';
import { UpdateEngineConfigDto } from './dto/update-engine-config.dto';

type Engine = 'yandex' | 'google';

@Controller('admin/test-bench/config')
@UseGuards(AdminGuard)
export class TestBenchEngineConfigController {
  constructor(private readonly cfg: TestBenchEngineConfigService) {}

  @Get()
  async all() {
    return this.cfg.getFullList();
  }

  @Get(':engine')
  async get(@Param('engine') engine: Engine) {
    return this.cfg.getFullConfig(engine);
  }

  @Patch(':engine')
  async update(
    @Param('engine') engine: Engine,
    @Body() dto: UpdateEngineConfigDto,
  ) {
    return this.cfg.update(engine, dto);
  }

  @Get(':engine/block')
  async getBlock(@Param('engine') engine: Engine) {
    return this.cfg.getBlock(engine);
  }

  @Patch(':engine/block/:value')
  async setBlock(
    @Param('engine') engine: Engine,
    @Param('value', ParseBoolPipe) value: boolean,
  ) {
    await this.cfg.setBlock(engine, value);
    return { ok: true, engine, blocked: value };
  }
}
