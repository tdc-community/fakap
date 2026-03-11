import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { NewsArticleStatus } from '../news.types';

export class ListNewsArticlesQueryDto {
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: NewsArticleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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
  @IsIn(['created_at', 'updated_at', 'published_at', 'title'])
  orderBy?: 'created_at' | 'updated_at' | 'published_at' | 'title';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

