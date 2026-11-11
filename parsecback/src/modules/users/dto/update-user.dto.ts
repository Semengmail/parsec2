import {
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;

  @IsOptional() @IsIn(['none', 'light', 'chic']) tariff?:
    | 'none'
    | 'light'
    | 'chic';
  @IsOptional() @IsInt() @Min(1) inFlightLimit?: number;
}
