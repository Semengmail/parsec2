import { AdminGuard } from '@/common/guards/admin.guard';
// src/modules/test-bench/test-bench-phrases-admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { TestBenchPhrasesAdminService } from './test-bench-phrases-admin.service';
import {
  CreateTestBenchPhraseDto,
  UpdateTestBenchPhraseDto,
  ListTestBenchPhrasesQueryDto,
} from './dto/upsert-test-bench-phrase.dto';
import { TestBenchPhrase } from './entities/test-bench-phrase.entity';

@Controller('admin/test-bench/phrases')
@UseGuards(AdminGuard)
export class TestBenchPhrasesAdminController {
  constructor(private readonly phrases: TestBenchPhrasesAdminService) {}

  @Get()
  async list(@Query() query: ListTestBenchPhrasesQueryDto): Promise<{
    items: TestBenchPhrase[];
    total: number;
    offset: number;
    limit: number;
  }> {
    return this.phrases.list(query);
  }

  @Get(':id')
  async getOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TestBenchPhrase> {
    return this.phrases.getOne(id);
  }

  @Post()
  async create(
    @Body() dto: CreateTestBenchPhraseDto,
  ): Promise<TestBenchPhrase> {
    return this.phrases.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestBenchPhraseDto,
  ): Promise<TestBenchPhrase> {
    return this.phrases.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.phrases.remove(id);
    return { ok: true };
  }
}
