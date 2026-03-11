import { IsString, MaxLength } from 'class-validator';

export class ExchangeAuthCodeDto {
  @IsString()
  @MaxLength(128)
  authCode!: string;
}

