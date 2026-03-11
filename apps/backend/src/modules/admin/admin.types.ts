import { AppUser, AppUserRole } from '../auth/types';

export type AdminUserListResult = {
  items: AppUser[];
  total: number;
};

export type DashboardMetrics = {
  users: {
    total: number;
    active: number;
    suspended: number;
    newLast7Days: number;
  };
  articles: {
    total: number;
    drafts: number;
    published: number;
    publishedLast7Days: number;
  };
  recentActions: Array<{
    id: string;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
  }>;
};

export type UserModerationEventType = 'role_changed' | 'suspended' | 'restored';

export type CreateUserModerationEventInput = {
  targetUserId: string;
  actorUserId: string;
  eventType: UserModerationEventType;
  previousRole: AppUserRole | null;
  newRole: AppUserRole | null;
  reason: string | null;
};

