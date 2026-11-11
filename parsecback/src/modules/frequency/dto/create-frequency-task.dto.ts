// src/modules/frequency/dto/create-frequency-task.dto.ts
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { FrequencyTypeId } from '../frequency.constants';

export class CreateFrequencyTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  url?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  keywords!: string[]; // наши запросы/фразы

  @IsOptional()
  // @IsInt()
  // @Min(1)
  region_key?: number; // город (LR). По умолчанию 225

  /**
   * Тип задачи:
   *  - 'frequency' — частоты Яндекс (KeyTurbo)
   *  - 'wordstat' — пока не реализован (вернём ошибку)
   */
  @IsString()
  @IsIn(['frequency', 'wordstat'])
  type!: 'frequency' | 'wordstat';

  /**
   * Типы частот (1–7).
   * Если не указаны — [1] (W).
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  frequencyTypes?: FrequencyTypeId[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  minusWords?: string[];

  @IsOptional()
  @IsBoolean()
  yearlyFrequency?: boolean;

  // @IsOptional()
  // @IsString()
  // soft_id?: string;
}
