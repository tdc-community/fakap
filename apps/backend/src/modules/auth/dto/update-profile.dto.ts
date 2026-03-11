import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(48)
  icCharacterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000_000)
  profileImageDataUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankAccountId?: string;
}
