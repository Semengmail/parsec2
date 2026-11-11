// src/modules/frequency/dto/get-frequency-task.dto.ts
import { IsInt } from 'class-validator';

export class GetFrequencyTaskDto {
  @IsInt()
  taskId!: number;
}
