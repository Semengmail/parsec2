import { Type } from 'class-transformer';
import { IsString, IsIn, IsInt, IsOptional, IsNumber } from 'class-validator';

export class CreatePublicTaskDto {
  @IsString()
  query!: string;

  @IsIn(['desktop', 'mobile'])
  device!: 'desktop' | 'mobile';

  @Type(() => Number)
  @IsInt()
  lr!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
