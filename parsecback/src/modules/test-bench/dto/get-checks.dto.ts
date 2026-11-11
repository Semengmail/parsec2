// src/modules/test-bench/dto/get-checks.dto.ts
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TestBenchCheckEngine } from '../entities/test-bench-check.entity';

export class GetChecksDto {
  @IsOptional()
  @IsEnum(['yandex', 'google', 'all'])
  engine?: TestBenchCheckEngine | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}
