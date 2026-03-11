import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppUser, AppUserRole } from '../auth/types';
import { DatabaseService } from '../database/database.service';
import { CreateUserModerationEventInput } from './admin.types';

type UserRow = {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
  ic_character_name: string | null;
  profile_image_url: string | null;
  bank_account_id: string | null;
  role: AppUserRole;
  suspended_at: Date | null;
  suspended_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class AdminRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listUsers(params: {
    search?: string;
    role?: AppUserRole;
    suspended?: boolean;
    limit: number;
    offset: number;
    orderBy: 'created_at' | 'updated_at' | 'username';
    order: 'asc' | 'desc';
  }): Promise<{ items: AppUser[]; total: number }> {
    const whereParts: string[] = [];
    const values: Array<string | number | boolean> = [];

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      whereParts.push(`(username ILIKE $${values.length} OR discord_id ILIKE $${values.length})`);
    }

    if (params.role) {
      values.push(params.role);
      whereParts.push(`role = $${values.length}`);
    }

    if (params.suspended !== undefined) {
      whereParts.push(params.suspended ? 'suspended_at IS NOT NULL' : 'suspended_at IS NULL');
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    values.push(params.limit);
    const limitPos = values.length;
    values.push(params.offset);
    const offsetPos = values.length;

    const [itemsResult, countResult] = await Promise.all([
      this.databaseService.pool.query<UserRow>(
        `
        SELECT
          id, discord_id, username, avatar_url, ic_character_name, profile_image_url,
          bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
        FROM users
        ${whereSql}
        ORDER BY ${params.orderBy} ${params.order}, id ASC
        LIMIT $${limitPos}
        OFFSET $${offsetPos}
        `,
        values,
      ),
      this.databaseService.pool.query<{ total: string }>(
        `
        SELECT COUNT(*)::text AS total
        FROM users
        ${whereSql}
        `,
        values.slice(0, values.length - 2),
      ),
    ]);

    return {
      items: itemsResult.rows.map((row: UserRow) => this.mapUser(row)),
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async findUserById(userId: string): Promise<AppUser | null> {
    const result = await this.databaseService.pool.query<UserRow>(
      `
      SELECT
        id, discord_id, username, avatar_url, ic_character_name, profile_image_url,
        bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (!result.rowCount) return null;
    return this.mapUser(result.rows[0]);
  }

  async updateUserRole(userId: string, role: AppUserRole): Promise<AppUser | null> {
    const result = await this.databaseService.pool.query<UserRow>(
      `
      UPDATE users
      SET role = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, discord_id, username, avatar_url, ic_character_name, profile_image_url,
        bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      `,
      [userId, role],
    );

    if (!result.rowCount) return null;
    return this.mapUser(result.rows[0]);
  }

  async suspendUser(userId: string, reason: string | null): Promise<AppUser | null> {
    const result = await this.databaseService.pool.query<UserRow>(
      `
      UPDATE users
      SET suspended_at = NOW(),
          suspended_reason = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, discord_id, username, avatar_url, ic_character_name, profile_image_url,
        bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      `,
      [userId, reason],
    );

    if (!result.rowCount) return null;
    return this.mapUser(result.rows[0]);
  }

  async restoreUser(userId: string): Promise<AppUser | null> {
    const result = await this.databaseService.pool.query<UserRow>(
      `
      UPDATE users
      SET suspended_at = NULL,
          suspended_reason = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, discord_id, username, avatar_url, ic_character_name, profile_image_url,
        bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      `,
      [userId],
    );

    if (!result.rowCount) return null;
    return this.mapUser(result.rows[0]);
  }

  async createModerationEvent(input: CreateUserModerationEventInput): Promise<void> {
    const id = randomUUID();
    await this.databaseService.pool.query(
      `
      INSERT INTO user_moderation_events (
        id, target_user_id, actor_user_id, event_type, previous_role, new_role, reason, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      [id, input.targetUserId, input.actorUserId, input.eventType, input.previousRole, input.newRole, input.reason],
    );
  }

  async getDashboardMetrics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    newUsersLast7Days: number;
    totalArticles: number;
    draftArticles: number;
    publishedArticles: number;
    publishedArticlesLast7Days: number;
  }> {
    const [users, articles, publishedLast7] = await Promise.all([
      this.databaseService.pool.query<{
        total_users: string;
        active_users: string;
        suspended_users: string;
        new_users_last_7_days: string;
      }>(
        `
        SELECT
          COUNT(*)::text AS total_users,
          COUNT(*) FILTER (WHERE suspended_at IS NULL)::text AS active_users,
          COUNT(*) FILTER (WHERE suspended_at IS NOT NULL)::text AS suspended_users,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS new_users_last_7_days
        FROM users
        `,
      ),
      this.databaseService.pool.query<{
        total_articles: string;
        draft_articles: string;
        published_articles: string;
      }>(
        `
        SELECT
          COUNT(*)::text AS total_articles,
          COUNT(*) FILTER (WHERE status = 'draft')::text AS draft_articles,
          COUNT(*) FILTER (WHERE status = 'published')::text AS published_articles
        FROM news_articles
        `,
      ),
      this.databaseService.pool.query<{ published_last_7_days: string }>(
        `
        SELECT COUNT(*)::text AS published_last_7_days
        FROM news_articles
        WHERE status = 'published'
          AND published_at >= NOW() - INTERVAL '7 days'
        `,
      ),
    ]);

    return {
      totalUsers: Number(users.rows[0]?.total_users ?? '0'),
      activeUsers: Number(users.rows[0]?.active_users ?? '0'),
      suspendedUsers: Number(users.rows[0]?.suspended_users ?? '0'),
      newUsersLast7Days: Number(users.rows[0]?.new_users_last_7_days ?? '0'),
      totalArticles: Number(articles.rows[0]?.total_articles ?? '0'),
      draftArticles: Number(articles.rows[0]?.draft_articles ?? '0'),
      publishedArticles: Number(articles.rows[0]?.published_articles ?? '0'),
      publishedArticlesLast7Days: Number(publishedLast7.rows[0]?.published_last_7_days ?? '0'),
    };
  }

  private mapUser(row: UserRow): AppUser {
    return {
      id: row.id,
      discordId: row.discord_id,
      username: row.username,
      avatarUrl: row.avatar_url,
      icCharacterName: row.ic_character_name,
      profileImageUrl: row.profile_image_url,
      bankAccountId: row.bank_account_id,
      role: row.role,
      suspendedAt: row.suspended_at ? row.suspended_at.toISOString() : null,
      suspendedReason: row.suspended_reason,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

