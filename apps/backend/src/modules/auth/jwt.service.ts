import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';
import { AppUserRole } from './types';
import { AuthTokens, JwtClaims } from './types';

@Injectable()
export class JwtService {
  constructor(private readonly configService: ConfigService) {}

  issueTokens(user: { id: string; discordId: string; role: AppUserRole }): AuthTokens {
    const accessSecret = this.required('JWT_ACCESS_SECRET');
    const refreshSecret = this.required('JWT_REFRESH_SECRET');

    const accessTtlSeconds = Number(this.configService.get<string>('JWT_ACCESS_TTL') ?? '900');
    const refreshTtlSeconds = Number(this.configService.get<string>('JWT_REFRESH_TTL') ?? '1209600');

    const base = {
      sub: user.id,
      discordId: user.discordId,
      role: user.role,
    } as const;

    const accessToken = sign({ ...base, type: 'access' }, accessSecret, {
      algorithm: 'HS256',
      expiresIn: accessTtlSeconds,
    });

    const refreshToken = sign({ ...base, type: 'refresh' }, refreshSecret, {
      algorithm: 'HS256',
      expiresIn: refreshTtlSeconds,
    });

    return { accessToken, refreshToken };
  }

  getRefreshTokenExpiryDate(fromDate = new Date()): Date {
    const refreshTtlSeconds = Number(this.configService.get<string>('JWT_REFRESH_TTL') ?? '1209600');
    return new Date(fromDate.getTime() + refreshTtlSeconds * 1000);
  }

  verifyAccessToken(token: string): JwtClaims {
    const accessSecret = this.required('JWT_ACCESS_SECRET');
    const payload = verify(token, accessSecret, { algorithms: ['HS256'] }) as JwtClaims;
    if (payload.type !== 'access') {
      throw new InternalServerErrorException('Invalid token type');
    }
    return payload;
  }

  verifyRefreshToken(token: string): JwtClaims {
    const refreshSecret = this.required('JWT_REFRESH_SECRET');
    const payload = verify(token, refreshSecret, { algorithms: ['HS256'] }) as JwtClaims;
    if (payload.type !== 'refresh') {
      throw new InternalServerErrorException('Invalid token type');
    }
    return payload;
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value || value.trim().length < 32) {
      throw new InternalServerErrorException(`Missing or weak config: ${key}`);
    }
    return value;
  }
}
