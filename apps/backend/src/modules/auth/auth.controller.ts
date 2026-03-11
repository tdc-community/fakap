import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogoutDto } from './dto/logout.dto';
import { ExchangeAuthCodeDto } from './dto/exchange-auth-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthService } from './auth.service';
import { BearerAuthGuard } from './bearer-auth.guard';
import { AppUser } from './types';
import { AppUserRole } from './types';

type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role: AppUserRole;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('discord/login')
  discordLogin(@Query('state') state: string | undefined, @Res() res: Response): void {
    res.redirect(302, this.authService.buildDiscordAuthorizeUrl(state));
  }

  @Get('discord/callback')
  async discordCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Res() res?: Response,
  ): Promise<void> {
    if (!code) {
      throw new UnauthorizedException('Missing code');
    }

    const { user, tokens } = await this.authService.exchangeCodeForTokens(code);
    const authCode = await this.authService.createAuthExchangeCode({ user, tokens });
    const redirectUrl = this.authService.buildFrontendCallbackUrl({
      authCode,
      state,
    });

    if (!res) {
      return;
    }

    res.redirect(302, redirectUrl);
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ user: AppUser; accessToken: string; refreshToken: string }> {
    const { user, tokens } = await this.authService.refresh(dto);
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Post('exchange-code')
  async exchangeAuthCode(
    @Body() dto: ExchangeAuthCodeDto,
  ): Promise<{ user: AppUser; accessToken: string; refreshToken: string }> {
    const { user, tokens } = await this.authService.consumeAuthExchangeCode(dto.authCode);
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @UseGuards(BearerAuthGuard)
  @Get('me')
  async me(@Req() req: AuthedRequest): Promise<{ user: AppUser }> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing principal');
    }

    return { user: await this.authService.me(userId) };
  }

  @UseGuards(BearerAuthGuard)
  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Body() dto: LogoutDto): Promise<{ ok: true }> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing principal');
    }

    await this.authService.logout(userId, dto);
    return { ok: true };
  }

  @UseGuards(BearerAuthGuard)
  @Post('profile')
  async updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto): Promise<{ user: AppUser }> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing principal');
    }

    return { user: await this.authService.updateProfile(userId, dto) };
  }

}
