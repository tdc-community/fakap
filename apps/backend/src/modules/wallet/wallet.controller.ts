import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { AppUserRole } from '../auth/types';
import { WithdrawDto } from './dto/withdraw.dto';
import { WalletService } from './wallet.service';

type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role: AppUserRole;
  };
};

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @UseGuards(BearerAuthGuard)
  @Get('balance')
  async balance(@Req() req: AuthedRequest): Promise<{ walletCode: string; balance: string }> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing principal');
    }

    return this.walletService.getBalanceForUser(userId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('transactions')
  async transactions(@Req() req: AuthedRequest): Promise<{
    transactions: Array<{
      id: string;
      hash: string;
      amount: number;
      asset: 'USD';
      timestamp: string;
      direction: 'send' | 'receive';
      status: 'success' | 'failed';
    }>;
  }> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing principal');
    }

    return this.walletService.getTransactionsForUser(userId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('withdraw')
  withdraw(@Req() req: AuthedRequest, @Body() dto: WithdrawDto): Promise<{
    walletCode: string;
    amount: number;
    status: 'accepted' | 'rejected';
    reason?: string;
    newBalance?: string;
  }> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing principal');
    }

    return this.walletService.withdraw(userId, dto);
  }
}
