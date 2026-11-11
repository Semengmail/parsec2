import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PublicInfoQueryDto {
  @IsString({ message: 'Параметр key должен быть строкой' })
  @IsNotEmpty({ message: 'Параметр key обязателен' })
  key!: string;

  /** как у XMLStock; по умолчанию "user" */
  @IsOptional()
  @IsString({ message: 'Параметр info должен быть строкой' })
  info?: string;

  /** необязательный идентификатор клиента */
  @IsOptional()
  @IsString({ message: 'Параметр soft_id должен быть строкой' })
  soft_id?: string;
}
