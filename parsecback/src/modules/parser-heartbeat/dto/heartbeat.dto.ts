// src/modules/parser-heartbeat/dto/heartbeat.dto.ts
import { IsString } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  parser: string;

  @IsString()
  server: string;
}
