import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class ExternalDepositDto {
  @IsString()
  @MaxLength(64)
  accountId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(128)
  deposit_id!: string;
}

