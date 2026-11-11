// src/modules/frequency/frequency.controller.ts
import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

import { FrequencyService } from './frequency.service';
import { CreateFrequencyTaskDto } from './dto/create-frequency-task.dto';
import type { ApiErrorResponse, ApiOkResponse } from './frequency.errors';

import { PublicApiKeyGuard } from '@/common/guards/public-api-key.guard';
import { UserId } from '@/common/decorators/user-id.decorator';
import { PublicJsonErrorFilter } from '@/common/filters/public-json-error.filter';

class StatusQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}

type CreateResponse = ApiErrorResponse | ApiOkResponse<{ taskId: number }>;

type GetResponse =
  | ApiErrorResponse
  | ApiOkResponse<{
      task: {
        taskId: number;
        state: 'pending' | 'completed' | 'error';
        progress: number;
        errorCode?: string | null;
        errorMessage?: string | null;
        result?: Array<{
          phrase: string;
          frequencyTypeId: number | null;
          frequencyTypeName: string;
          frequency: number;
        }>;
      };
    }>;

@ApiTags('Public Frequency API')
@UseGuards(PublicApiKeyGuard)
@UseFilters(PublicJsonErrorFilter)
@Controller('public/frequency/json')
export class FrequencyController {
  constructor(private readonly freq: FrequencyService) {}

  // ------------------------------------------------------------------------
  // POST /public/frequency/json  (создать задачу)
  // ------------------------------------------------------------------------

  @Post()
  @ApiOperation({
    summary: 'Создать задачу на сбор частот',
    description: `
    Создаёт задачу частот в стиле KeyTurbo, но со стандартом XMLStock (status/code/error).
    Все ошибки — HTTP 200 с полем "status: error".
    `,
  })
  @ApiQuery({
    name: 'user',
    required: true,
    description: 'ID пользователя (из публичного API)',
  })
  @ApiQuery({
    name: 'key',
    required: true,
    description: 'Публичный API-ключ',
  })
  @ApiBody({
    description: 'Параметры задачи частоты',
    type: CreateFrequencyTaskDto,
  })
  @ApiResponse({
    status: 200,
    description: 'JSON ответ: ok/error (стандарт XMLStock)',
  })
  @Header('Content-Type', 'application/json; charset=utf-8')
  async create(
    @UserId() userId: number,
    @Body() dto: CreateFrequencyTaskDto,
    @Query('soft_id') softId?: string,
  ): Promise<CreateResponse> {
    return this.freq.createTask(userId, dto, softId ?? null);
  }

  // ------------------------------------------------------------------------
  // GET /public/frequency/json/status?taskId=123
  // ------------------------------------------------------------------------

  @Get('status')
  @ApiOperation({
    summary: 'Получить статус/результат задачи',
    description: `
      Возвращает pending/completed/error в JSON.
      После получения completed задача удаляется.
`,
  })
  @ApiQuery({
    name: 'user',
    required: true,
    description: 'ID пользователя (из публичного API)',
  })
  @ApiQuery({
    name: 'key',
    required: true,
    description: 'Публичный API-ключ',
  })
  @ApiQuery({
    name: 'taskId',
    required: true,
    description: 'ID задачи частот',
  })
  @ApiResponse({
    status: 200,
    description: 'JSON ответ: ok/error',
  })
  @Header('Content-Type', 'application/json; charset=utf-8')
  async status(
    @UserId() userId: number,
    @Query() q: StatusQueryDto,
  ): Promise<GetResponse> {
    if (!q.id || !Number.isInteger(q.id)) {
      return {
        status: 'error',
        code: 2001,
        error: 'Некорректный идентификатор задачи (id)',
      };
    }

    return this.freq.getTask(userId, q.id);
  }
}
