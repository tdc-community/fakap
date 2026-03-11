import { IsIn, IsNumber } from 'class-validator';

export class VoteVehiclePostDto {
  @IsNumber()
  @IsIn([-1, 0, 1])
  vote!: -1 | 0 | 1;
}
