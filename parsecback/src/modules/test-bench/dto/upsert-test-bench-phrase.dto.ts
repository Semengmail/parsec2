// src/modules/test-bench/dto/upsert-test-bench-phrase.dto.ts
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  TestBenchPhraseEngine,
  TestBenchPhraseType,
} from '../entities/test-bench-phrase.entity';

const TYPES: TestBenchPhraseType[] = ['speed', 'position', 'selector'];
const ENGINES: TestBenchPhraseEngine[] = ['yandex', 'google'];

export class CreateTestBenchPhraseDto {
  @IsString()
  @MaxLength(2000)
  phrase!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(TYPES)
  type?: TestBenchPhraseType;

  @IsOptional()
  @IsIn(ENGINES)
  searchEngine?: TestBenchPhraseEngine | null;
}

export class UpdateTestBenchPhraseDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  phrase?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | null;

  @IsOptional()
  @IsIn(TYPES)
  type?: TestBenchPhraseType;

  @IsOptional()
  @IsIn(ENGINES)
  searchEngine?: TestBenchPhraseEngine | null;
}

export class ListTestBenchPhrasesQueryDto {
  @IsOptional()
  @IsIn(TYPES)
  type?: TestBenchPhraseType;

  @IsOptional()
  @IsIn(ENGINES)
  engine?: TestBenchPhraseEngine;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
