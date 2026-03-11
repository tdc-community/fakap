import {
  Body,
  ConflictException,
  Controller,
  Headers,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalDepositDto } from './dto/external-deposit.dto';
import { WalletService } from './wallet.service';

@Controller()
export class ExternalDepositController {
  constructor(
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
  ) {}

  @Post('deposit')
  async ingest(
    @Headers('x-api-key') apiKey: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: ExternalDepositDto,
  ): Promise<{
    status: 'accepted';
    idempotent: boolean;
    walletCode: string;
    amount: number;
    depositId: string;
    newBalance?: string;
  }> {
    const configured = this.configService.get<string>('DEPOSIT_API_KEY');
    if (!configured?.trim()) {
      throw new ServiceUnavailableException('Missing DEPOSIT_API_KEY');
    }

    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
    const provided = apiKey?.trim() || bearer;
    if (!provided || provided !== configured.trim()) {
      throw new UnauthorizedException('Invalid API key');
    }

    const result = await this.walletService.ingestExternalDeposit(dto);
    if (result.status === 'conflict') {
      throw new ConflictException('deposit_id_reused_with_different_payload');
    }
    if (result.status === 'unknown_account') {
      throw new NotFoundException('wallet_account_not_found');
    }

    return {
      status: 'accepted',
      idempotent: result.idempotent,
      walletCode: result.walletCode,
      amount: dto.amount,
      depositId: dto.deposit_id,
      newBalance: result.newBalance,
    };
  }
}
