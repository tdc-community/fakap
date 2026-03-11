import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { LogoutDto } from './dto/logout.dto';
import { URLSearchParams } from 'node:url';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtService } from './jwt.service';
import { AppUser, AuthTokens, DiscordTokenResponse, DiscordUserResponse } from './types';
import { RefreshSessionsService } from './refresh-sessions.service';
import { UsersRepository } from './users.repository';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly refreshSessionsService: RefreshSessionsService,
    private readonly databaseService: DatabaseService,
  ) {}

  buildDiscordAuthorizeUrl(state?: string): string {
    const clientId = this.required('DISCORD_CLIENT_ID');
    const redirectUri = this.required('DISCORD_REDIRECT_URI');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'identify',
      prompt: 'none',
    });
    if (state?.trim()) {
      params.set('state', state.trim());
    }

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{ user: AppUser; tokens: AuthTokens }> {
    const tokenData = await this.exchangeCode(this.normalizeOauthCode(code));
    const discordUser = await this.fetchDiscordUser(tokenData.access_token);

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    const user = await this.usersRepository.upsertFromDiscord({
      discordId: discordUser.id,
      username: discordUser.username,
      avatarUrl,
    });

    const tokens = this.jwtService.issueTokens({
      id: user.id,
      discordId: user.discordId,
      role: user.role,
    });

    await this.refreshSessionsService.createSession({
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: this.jwtService.getRefreshTokenExpiryDate(),
    });

    return { user, tokens };
  }

  async refresh(dto: RefreshTokenDto): Promise<{ user: AppUser; tokens: AuthTokens }> {
    const claims = this.jwtService.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersRepository.findById(claims.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = this.jwtService.issueTokens({
      id: user.id,
      discordId: user.discordId,
      role: user.role,
    });

    await this.refreshSessionsService.rotateSession({
      previousRefreshToken: dto.refreshToken,
      newRefreshToken: tokens.refreshToken,
      userId: user.id,
      newExpiresAt: this.jwtService.getRefreshTokenExpiryDate(),
    });

    return { user, tokens };
  }

  async me(userId: string): Promise<AppUser> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AppUser> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing) {
      throw new UnauthorizedException('User not found');
    }

    const icCharacterName =
      dto.icCharacterName !== undefined
        ? dto.icCharacterName.trim()
          ? dto.icCharacterName.trim()
          : null
        : existing.icCharacterName;
    const profileImageUrl =
      dto.profileImageDataUrl !== undefined
        ? dto.profileImageDataUrl.trim()
          ? dto.profileImageDataUrl.trim()
          : null
        : existing.profileImageUrl;
    const bankAccountId =
      dto.bankAccountId !== undefined
        ? dto.bankAccountId.trim()
          ? dto.bankAccountId.trim()
          : null
        : existing.bankAccountId;

    return this.usersRepository.updateProfileByUserId({
      userId,
      icCharacterName,
      profileImageUrl,
      bankAccountId,
    });
  }

  buildFrontendCallbackUrl(input: { authCode: string; state?: string }): string {
    const frontendBase =
      this.configService.get<string>('FRONTEND_PUBLIC_URL') ??
      this.configService.get<string>('CORS_ORIGIN') ??
      'http://localhost:5173';

    const params = new URLSearchParams({
      authCode: input.authCode,
    });
    if (input.state?.trim()) {
      params.set('state', input.state.trim());
    }

    return `${frontendBase.replace(/\/$/, '')}/auth/callback?${params.toString()}`;
  }

  async createAuthExchangeCode(input: { user: AppUser; tokens: AuthTokens }): Promise<string> {
    await this.cleanupExpiredAuthCodes();
    const authCode = randomBytes(32).toString('hex');
    const codeHash = this.hashAuthCode(authCode);
    const configuredTtl = Number.parseInt(this.configService.get<string>('AUTH_EXCHANGE_CODE_TTL') ?? '60', 10);
    const ttlSeconds = Number.isFinite(configuredTtl) ? configuredTtl : 60;

    await this.databaseService.pool.query(
      `
      INSERT INTO auth_exchange_codes (
        code_hash,
        user_id,
        access_token,
        refresh_token,
        expires_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW() + ($5 || ' seconds')::interval, NOW())
      `,
      [
        codeHash,
        input.user.id,
        input.tokens.accessToken,
        input.tokens.refreshToken,
        Math.max(5, Math.min(ttlSeconds, 600)),
      ],
    );

    return authCode;
  }

  async consumeAuthExchangeCode(authCode: string): Promise<{ user: AppUser; tokens: AuthTokens }> {
    await this.cleanupExpiredAuthCodes();
    const codeHash = this.hashAuthCode(authCode);

    const result = await this.databaseService.pool.query<{
      user_id: string;
      access_token: string;
      refresh_token: string;
    }>(
      `
      DELETE FROM auth_exchange_codes
      WHERE code_hash = $1
        AND expires_at > NOW()
      RETURNING user_id, access_token, refresh_token
      `,
      [codeHash],
    );

    if (!result.rowCount) {
      throw new UnauthorizedException('Invalid or expired auth code');
    }

    const row = result.rows[0];
    const user = await this.usersRepository.findById(row.user_id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user,
      tokens: {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
      },
    };
  }

  async logout(userId: string, dto: LogoutDto): Promise<void> {
    await this.refreshSessionsService.revokeSession({
      refreshToken: dto.refreshToken,
      userId,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshSessionsService.revokeAllSessionsForUser(userId);
  }

  private async exchangeCode(code: string): Promise<DiscordTokenResponse> {
    const clientId = this.required('DISCORD_CLIENT_ID');
    const clientSecret = this.required('DISCORD_CLIENT_SECRET');
    const redirectUri = this.required('DISCORD_REDIRECT_URI');

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new UnauthorizedException('Discord token exchange failed');
    }

    return (await response.json()) as DiscordTokenResponse;
  }

  private async fetchDiscordUser(accessToken: string): Promise<DiscordUserResponse> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Discord profile fetch failed');
    }

    return (await response.json()) as DiscordUserResponse;
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value || !value.trim()) {
      throw new UnauthorizedException(`Missing config: ${key}`);
    }
    return value;
  }

  private async cleanupExpiredAuthCodes(): Promise<void> {
    await this.databaseService.pool.query(
      `
      DELETE FROM auth_exchange_codes
      WHERE expires_at <= NOW()
      `,
    );
  }

  private normalizeOauthCode(code: string): string {
    return code.trim().replace(/ /g, '+');
  }

  private hashAuthCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
