import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppUser, AppUserRole } from '../auth/types';
import { AdminRepository } from './admin.repository';
import { DashboardMetrics } from './admin.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(params: {
    search?: string;
    role?: AppUserRole;
    suspended?: boolean;
    limit: number;
    offset: number;
    orderBy: 'created_at' | 'updated_at' | 'username';
    order: 'asc' | 'desc';
  }): Promise<{ items: AppUser[]; total: number }> {
    return this.adminRepository.listUsers(params);
  }

  async getUser(userId: string): Promise<AppUser> {
    const user = await this.adminRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async changeUserRole(input: {
    actorUserId: string;
    targetUserId: string;
    role: AppUserRole;
  }): Promise<AppUser> {
    const existing = await this.adminRepository.findUserById(input.targetUserId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.role === input.role) {
      return existing;
    }

    const updated = await this.adminRepository.updateUserRole(input.targetUserId, input.role);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await this.adminRepository.createModerationEvent({
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      eventType: 'role_changed',
      previousRole: existing.role,
      newRole: input.role,
      reason: null,
    });

    await this.auditService.log({
      actorUserId: input.actorUserId,
      action: 'admin.user.role_changed',
      targetType: 'user',
      targetId: input.targetUserId,
      payload: {
        previousRole: existing.role,
        newRole: input.role,
      },
    });

    return updated;
  }

  async suspendUser(input: {
    actorUserId: string;
    targetUserId: string;
    reason?: string;
  }): Promise<AppUser> {
    const existing = await this.adminRepository.findUserById(input.targetUserId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (existing.suspendedAt) {
      throw new BadRequestException('User already suspended');
    }

    const updated = await this.adminRepository.suspendUser(input.targetUserId, input.reason?.trim() || null);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await this.adminRepository.createModerationEvent({
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      eventType: 'suspended',
      previousRole: existing.role,
      newRole: existing.role,
      reason: input.reason?.trim() || null,
    });

    await this.auditService.log({
      actorUserId: input.actorUserId,
      action: 'admin.user.suspended',
      targetType: 'user',
      targetId: input.targetUserId,
      payload: {
        reason: input.reason?.trim() || null,
      },
    });

    return updated;
  }

  async restoreUser(input: {
    actorUserId: string;
    targetUserId: string;
  }): Promise<AppUser> {
    const existing = await this.adminRepository.findUserById(input.targetUserId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (!existing.suspendedAt) {
      throw new BadRequestException('User is not suspended');
    }

    const updated = await this.adminRepository.restoreUser(input.targetUserId);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await this.adminRepository.createModerationEvent({
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      eventType: 'restored',
      previousRole: existing.role,
      newRole: existing.role,
      reason: null,
    });

    await this.auditService.log({
      actorUserId: input.actorUserId,
      action: 'admin.user.restored',
      targetType: 'user',
      targetId: input.targetUserId,
      payload: {},
    });

    return updated;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [counts, recentActions] = await Promise.all([
      this.adminRepository.getDashboardMetrics(),
      this.auditService.listRecent(15),
    ]);

    return {
      users: {
        total: counts.totalUsers,
        active: counts.activeUsers,
        suspended: counts.suspendedUsers,
        newLast7Days: counts.newUsersLast7Days,
      },
      articles: {
        total: counts.totalArticles,
        drafts: counts.draftArticles,
        published: counts.publishedArticles,
        publishedLast7Days: counts.publishedArticlesLast7Days,
      },
      recentActions: recentActions.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        createdAt: row.createdAt,
      })),
    };
  }
}

