import { SetMetadata } from '@nestjs/common';
import { AppUserRole } from './types';

export const REQUIRED_ROLES_KEY = 'required_roles';

export function RequireRoles(...roles: AppUserRole[]): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRED_ROLES_KEY, roles);
}

