import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class WithdrawDto {
  @Transform(({ value }: TransformFnParams) => (value === undefined ? undefined : Number(value)))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}
