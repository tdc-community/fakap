import { ConflictException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationError, validate } from 'class-validator';
import { ExternalDepositController } from './external-deposit.controller';
import { ExternalDepositDto } from './dto/external-deposit.dto';
import { WalletService } from './wallet.service';

describe('ExternalDepositController', () => {
  const baseDto: ExternalDepositDto = {
    walletCode: 'FP-1234567',
    amount: 500,
    deposit_id: 'dep_001',
  };

  function makeController(options?: {
    apiKey?: string | null;
    ingestResult?:
      | { status: 'accepted'; idempotent: boolean; walletCode: string; newBalance: string }
      | { status: 'conflict' }
      | { status: 'unknown_account' };
  }): ExternalDepositController {
    const walletService = {
      ingestExternalDeposit: jest.fn().mockResolvedValue(
        options?.ingestResult ?? {
          status: 'accepted',
          idempotent: false,
          walletCode: 'FP-1234567',
          newBalance: '900.00',
        },
      ),
    } as unknown as WalletService;

    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'DEPOSIT_API_KEY') return options?.apiKey === undefined ? 'secret' : options.apiKey;
        return undefined;
      }),
    } as unknown as ConfigService;

    return new ExternalDepositController(walletService, configService);
  }

  it('accepts valid deposit', async () => {
    const controller = makeController();
    const result = await controller.ingest('secret', undefined, baseDto);
    expect(result).toEqual({
      status: 'accepted',
      idempotent: false,
      walletCode: 'FP-1234567',
      amount: 500,
      depositId: 'dep_001',
      newBalance: '900.00',
    });
  });

  it('returns idempotent success on replay', async () => {
    const controller = makeController({
      ingestResult: {
        status: 'accepted',
        idempotent: true,
        walletCode: 'FP-1234567',
        newBalance: '900.00',
      },
    });
    const result = await controller.ingest('secret', undefined, baseDto);
    expect(result.idempotent).toBe(true);
  });

  it('throws 409 on deposit_id conflict with mismatch payload', async () => {
    const controller = makeController({ ingestResult: { status: 'conflict' } });
    await expect(controller.ingest('secret', undefined, baseDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws unauthorized on missing/invalid auth', async () => {
    const controller = makeController();
    await expect(controller.ingest(undefined, undefined, baseDto)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.ingest('wrong', undefined, baseDto)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.ingest(undefined, 'Bearer wrong', baseDto)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts bearer token auth equivalent to x-api-key', async () => {
    const controller = makeController();
    const result = await controller.ingest(undefined, 'Bearer secret', baseDto);
    expect(result.status).toBe('accepted');
  });

  it('throws service unavailable when DEPOSIT_API_KEY is not configured', async () => {
    const controller = makeController({ apiKey: null });
    await expect(controller.ingest('secret', undefined, baseDto)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws not found for unknown account behavior', async () => {
    const controller = makeController({ ingestResult: { status: 'unknown_account' } });
    await expect(controller.ingest('secret', undefined, baseDto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates invalid amount with DTO rules', async () => {
    const invalid = new ExternalDepositDto();
    invalid.walletCode = 'BAD-1';
    invalid.deposit_id = 'dep_bad';
    invalid.amount = 0;

    const errors = await validate(invalid);
    expect(errors.some((err: ValidationError) => err.property === 'amount')).toBe(true);
    expect(errors.some((err: ValidationError) => err.property === 'walletCode')).toBe(true);
  });
});
