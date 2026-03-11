import { IsIn } from 'class-validator';

export class ChangeUserRoleDto {
  @IsIn(['user', 'moderator', 'admin'])
  role!: 'user' | 'moderator' | 'admin';
}

