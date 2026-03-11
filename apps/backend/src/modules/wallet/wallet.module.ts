import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ExternalDepositController } from './external-deposit.controller';
import { WalletController } from './wallet.controller';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WalletController, ExternalDepositController],
  providers: [WalletService, WalletRepository],
  exports: [WalletRepository],
})
export class WalletModule {}
