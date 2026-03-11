import { IsIn } from 'class-validator';

export class SetNewsStatusDto {
  @IsIn(['draft', 'published'])
  status!: 'draft' | 'published';
}

