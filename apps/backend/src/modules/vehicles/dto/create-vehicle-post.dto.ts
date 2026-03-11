import { IsArray, IsNotEmpty, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateVehiclePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  description!: string;

  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  imageUrls!: string[];
}
