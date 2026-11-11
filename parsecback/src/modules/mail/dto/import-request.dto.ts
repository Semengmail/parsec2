import { IsNotEmpty, IsString } from 'class-validator';

export class ImportRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Контакт обязателен' })
  contact: string;
}
