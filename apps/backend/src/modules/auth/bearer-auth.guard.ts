import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AppUserRole } from './types';
import { JwtService } from './jwt.service';

type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role: AppUserRole;
    discordId: string;
  };
};

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    const claims = this.jwtService.verifyAccessToken(token);
    req.auth = {
      userId: claims.sub,
      role: claims.role,
      discordId: claims.discordId,
    };

    return true;
  }
}
