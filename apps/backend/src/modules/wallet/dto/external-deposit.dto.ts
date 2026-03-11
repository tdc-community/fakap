import { IsNumber, IsString, Matches, MaxLength, Min } from 'class-validator';

export class ExternalDepositDto {
  @IsString()
  @MaxLength(10)
  @Matches(/^FP-\d{7}$/)
  walletCode!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(128)
  deposit_id!: string;
}
