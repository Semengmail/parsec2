import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional } from 'class-validator';

export class GenericSettingsDto {
  @IsOptional()
  @IsIn(['desktop', 'mobile'])
  device?: 'desktop' | 'mobile';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'lr должен быть целым числом' })
  lr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number | null;
}
