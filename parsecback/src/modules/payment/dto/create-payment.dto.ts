import { IsNumber } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  sum: number;
  userId: number;
}
