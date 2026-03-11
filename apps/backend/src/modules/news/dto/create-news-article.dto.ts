import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateNewsArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  summary!: string;

  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  content!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  category!: string;
}

