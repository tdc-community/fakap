import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { UsersRepository } from '../auth/users.repository';
import { ExternalDepositDto } from './dto/external-deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { WalletRepository } from './wallet.repository';

@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.walletRepository.ensureTables();
  }

  async ingestExternalDeposit(dto: ExternalDepositDto): Promise<
    | {
        status: 'accepted';
        idempotent: boolean;
        accountIdentifier: string;
        newBalance: string;
      }
    | {
        status: 'conflict';
      }
    | {
        status: 'unknown_account';
      }
  > {
    const amount = this.toMoneyAmount(dto.amount);
    return this.walletRepository.ingestExternalDeposit({
      accountIdentifier: dto.accountId,
      amount,
      depositId: dto.deposit_id,
    });
  }

  async getBalanceForUser(userId: string): Promise<{ accountIdentifier: string; balance: string }> {
    return this.walletRepository.getBalanceByAccountIdentifier(userId);
  }

  async getTransactionsForUser(userId: string): Promise<{
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
    const items = await this.walletRepository.listTransactionsByAccountIdentifier(userId);
    return {
      transactions: items.map((item) => ({
        ...item,
        asset: 'USD' as const,
      })),
    };
  }

  async withdraw(userId: string, dto: WithdrawDto): Promise<{
    accountIdentifier: string;
    amount: number;
    status: 'accepted' | 'rejected';
    reason?: string;
    newBalance?: string;
  }> {
    const amount = this.toMoneyAmount(dto.amount);
    const account = await this.walletRepository.findOrCreateWalletAccount(userId);

    const user = await this.usersRepository.findById(userId);
    const bankAccountIdRaw = user?.bankAccountId?.trim() ?? '';
    if (!bankAccountIdRaw) {
        return {
          accountIdentifier: account.accountIdentifier,
          amount,
          status: 'rejected',
          reason: 'missing_bank_account_id',
        };
    }

    const bankAccountId = Number(bankAccountIdRaw);
    if (!Number.isFinite(bankAccountId)) {
        return {
          accountIdentifier: account.accountIdentifier,
          amount,
          status: 'rejected',
          reason: 'invalid_bank_account_id',
        };
    }

    const deducted = await this.walletRepository.subtractBalance(account.id, amount);
    if (!deducted.ok) {
        return {
          accountIdentifier: account.accountIdentifier,
          amount,
          status: 'rejected',
          reason: 'insufficient_balance',
        };
    }

    const externalWithdrawUrl = this.configService.get<string>('WITHDRAWAL_PROVIDER_URL');
    if (!externalWithdrawUrl) {
      throw new ServiceUnavailableException('Missing WITHDRAWAL_PROVIDER_URL');
    }

    const providerApiKey = this.configService.get<string>('WITHDRAWAL_PROVIDER_API_KEY');
    const providerUserAgent = this.configService.get<string>('WITHDRAWAL_PROVIDER_USER_AGENT') ?? 'tdc-backend';
    const providerTimeoutMs = Number(this.configService.get<string>('WITHDRAWAL_PROVIDER_TIMEOUT_MS') ?? '8000');
    const withdrawId = `fp_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': providerUserAgent,
    };
    if (providerApiKey?.trim()) {
      headers['x-api-key'] = providerApiKey.trim();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, providerTimeoutMs));

    let response: Response;
    try {
      response = await fetch(externalWithdrawUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
          body: JSON.stringify({
            withdraw_id: withdrawId,
            amount,
            bank_account_id: bankAccountId,
          }),
        });
    } catch {
      if (deducted.txId) {
        await this.walletRepository.markTransactionFailed(deducted.txId, 'provider_unreachable');
      }
      await this.walletRepository.addBalance(account.id, amount, 'withdrawal_revert', {
        hash: withdrawId,
        note: 'withdrawal_provider_unreachable_revert',
      });
      return {
        accountIdentifier: account.accountIdentifier,
        amount,
        status: 'rejected',
        reason: 'provider_unreachable',
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (deducted.txId) {
        await this.walletRepository.markTransactionFailed(deducted.txId, 'provider_rejected');
      }
      await this.walletRepository.addBalance(account.id, amount, 'withdrawal_revert', {
        hash: withdrawId,
        note: 'withdrawal_provider_revert',
      });
      return {
        accountIdentifier: account.accountIdentifier,
        amount,
        status: 'rejected',
        reason: 'provider_rejected',
      };
    }

    return {
      accountIdentifier: account.accountIdentifier,
      amount,
      status: 'accepted',
      newBalance: deducted.balance,
    };
  }

  private toMoneyAmount(input: number): number {
    return Math.round(input * 100) / 100;
  }
}
