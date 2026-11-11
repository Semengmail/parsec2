// src/modules/test-bench/dto/get-position-summary.dto.ts
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import * as testBenchPositionEntity from '../entities/test-bench-position.entity';

export class GetPositionSummaryDto {
  @IsEnum(['yandex', 'google'])
  engine!: testBenchPositionEntity.TestBenchPositionEngine;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}
