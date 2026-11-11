// src/modules/test-bench/dto/get-positions.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class GetPositionsDto {
  @IsEnum(['yandex', 'google'])
  engine!: 'yandex' | 'google';

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  days!: number;
}
