import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AppUserRole } from '../../auth/types';

export class ListAdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['user', 'moderator', 'admin'])
  role?: AppUserRole;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) => {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  suspended?: boolean;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['created_at', 'updated_at', 'username'])
  orderBy?: 'created_at' | 'updated_at' | 'username';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
