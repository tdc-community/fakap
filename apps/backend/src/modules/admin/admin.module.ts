import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminRepository, AdminService],
  exports: [AdminRepository, AdminService],
})
export class AdminModule {}

