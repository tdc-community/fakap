import { IsString, MaxLength } from 'class-validator';

export class DiscordCodeDto {
  @IsString()
  @MaxLength(512)
  code!: string;
}

