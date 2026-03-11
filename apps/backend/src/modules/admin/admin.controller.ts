import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AppUserRole } from '../auth/types';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { AdminService } from './admin.service';

type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role: AppUserRole;
  };
};

@Controller('admin')
@UseGuards(BearerAuthGuard, RolesGuard)
@RequireRoles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.adminService.listUsers({
      search: query.search,
      role: query.role,
      suspended: query.suspended,
      limit: Math.min(query.limit ?? 20, 100),
      offset: query.offset ?? 0,
      orderBy: query.orderBy ?? 'updated_at',
      order: query.order ?? 'desc',
    });
  }

  @Get('users/:userId')
  async getUser(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return { user: await this.adminService.getUser(userId) };
  }

  @Patch('users/:userId/role')
  async changeRole(
    @Req() req: AuthedRequest,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: ChangeUserRoleDto,
  ) {
    const actorUserId = req.auth?.userId;
    if (!actorUserId) throw new UnauthorizedException('Missing principal');
    return {
      user: await this.adminService.changeUserRole({
        actorUserId,
        targetUserId: userId,
        role: dto.role,
      }),
    };
  }

  @Post('users/:userId/suspend')
  async suspend(
    @Req() req: AuthedRequest,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: SuspendUserDto,
  ) {
    const actorUserId = req.auth?.userId;
    if (!actorUserId) throw new UnauthorizedException('Missing principal');
    return {
      user: await this.adminService.suspendUser({
        actorUserId,
        targetUserId: userId,
        reason: dto.reason,
      }),
    };
  }

  @Post('users/:userId/restore')
  async restore(@Req() req: AuthedRequest, @Param('userId', new ParseUUIDPipe()) userId: string) {
    const actorUserId = req.auth?.userId;
    if (!actorUserId) throw new UnauthorizedException('Missing principal');
    return {
      user: await this.adminService.restoreUser({
        actorUserId,
        targetUserId: userId,
      }),
    };
  }

  @Get('dashboard/metrics')
  async dashboardMetrics() {
    return this.adminService.getDashboardMetrics();
  }
}
