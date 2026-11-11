// src/modules/test-bench/dto/update-engine-config.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateEngineConfigDto {
  @IsOptional()
  @IsBoolean()
  autoblockEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoblockSelectors?: boolean;

  @IsOptional()
  @IsBoolean()
  autoblockPositionsJump?: boolean;

  @IsOptional()
  @IsBoolean()
  autoblockPositionsMissing?: boolean;

  @IsOptional()
  @IsBoolean()
  telegramAlertsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  positionJumpDiffWarning?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxMissingPositionsPerRun?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  positionTestSite?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  positionTestLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  speedTestLimit?: number;

  /** CAPTCHA METRICS */

  @IsOptional()
  @IsBoolean()
  captchaAlertsEnabled?: boolean;

  /** Пороги avgNonZero */

  @IsOptional()
  @IsNumber()
  @Min(0)
  captchaAvgNonZeroLimitDesktop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  captchaAvgNonZeroLimitMobile?: number;

  /** минимальные avgNonZero */

  @IsOptional()
  @IsNumber()
  @Min(0)
  captchaAvgNonZeroMinDesktop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  captchaAvgNonZeroMinMobile?: number;

  /** ✔ включение alert'ов для minAvg */

  @IsOptional()
  @IsBoolean()
  captchaMinAvgAlertEnabled?: boolean;

  /** Пороги процента нулевых капч */

  @IsOptional()
  @IsNumber()
  @Min(0)
  captchaZeroPercentLimitDesktop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  captchaZeroPercentLimitMobile?: number;

  /** Cron-времена вида "07:00", "20:00" */

  @IsOptional()
  @IsString({ each: true })
  captchaScheduleTimes?: string[];
}
