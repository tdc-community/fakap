import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuctionsModule } from './auctions/auctions.module';
import { ContestsModule } from './contests/contests.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ModerationModule } from './moderation/moderation.module';
import { NewsModule } from './news/news.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WalletModule } from './wallet/wallet.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    NewsModule,
    AdminModule,
    WalletModule,
    VehiclesModule,
    AuctionsModule,
    ContestsModule,
    ModerationModule,
    WebhooksModule,
  ],
})
export class AppModule {}
