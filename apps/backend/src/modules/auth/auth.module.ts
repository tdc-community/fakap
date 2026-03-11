import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BearerAuthGuard } from './bearer-auth.guard';
import { JwtService } from './jwt.service';
import { RefreshSessionsService } from './refresh-sessions.service';
import { RolesGuard } from './roles.guard';
import { UsersRepository } from './users.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, JwtService, UsersRepository, RefreshSessionsService, BearerAuthGuard, RolesGuard],
  exports: [AuthService, JwtService, BearerAuthGuard, RolesGuard, UsersRepository],
})
export class AuthModule {}
