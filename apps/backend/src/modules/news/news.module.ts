import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NewsController } from './news.controller';
import { NewsRepository } from './news.repository';
import { NewsService } from './news.service';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [NewsController],
  providers: [NewsRepository, NewsService],
  exports: [NewsService, NewsRepository],
})
export class NewsModule {}

