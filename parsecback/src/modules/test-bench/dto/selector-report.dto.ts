// src/modules/test-bench/dto/selector-report.dto.ts
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import * as testBenchCheckEntity from '../entities/test-bench-check.entity';

export class SelectorReportDto {
  @IsEnum(['yandex', 'google'])
  engine!: testBenchCheckEntity.TestBenchCheckEngine;

  @IsEnum(['desktop', 'mobile'])
  device!: testBenchCheckEntity.TestBenchCheckDevice;

  @IsString()
  phrase!: string;

  /** true, если выдачи реально НЕТ (спец-фраза для этого кейса) */
  @IsBoolean()
  noResults!: boolean;

  /** true, если у результатов есть корректный селектор урла */
  @IsBoolean()
  urlSelectorOk!: boolean;

  /** Доп. инфа от бота (css/xpath, что именно не нашли и т.д.) */
  @IsOptional()
  @IsString()
  comment?: string;

  /** Желательно передавать из BAS, чтобы поздний report точно попал в свой run */
  @IsOptional()
  @IsInt()
  runId?: number;

  /** ID public-api задачи; можно передавать из BAS для точной привязки report к run */
  @IsOptional()
  @IsInt()
  taskId?: number;
}
