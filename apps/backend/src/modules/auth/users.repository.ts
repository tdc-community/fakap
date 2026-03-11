import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AppUser, AppUserRole } from './types';

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
export class UsersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async upsertFromDiscord(input: {
    discordId: string;
    username: string;
    avatarUrl: string | null;
  }): Promise<AppUser> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.databaseService.pool.query<UserRow>(
      `
      INSERT INTO users (id, discord_id, username, avatar_url, ic_character_name, profile_image_url, bank_account_id, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5, $6, $6)
      ON CONFLICT (discord_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = EXCLUDED.updated_at
      RETURNING id, discord_id, username, avatar_url, ic_character_name, profile_image_url, bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      `,
      [id, input.discordId, input.username, input.avatarUrl, 'user', now],
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(userId: string): Promise<AppUser | null> {
    const result = await this.databaseService.pool.query<UserRow>(
      `
      SELECT id, discord_id, username, avatar_url, ic_character_name, profile_image_url, bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async updateProfileByUserId(input: {
    userId: string;
    icCharacterName: string | null;
    profileImageUrl: string | null;
    bankAccountId: string | null;
  }): Promise<AppUser> {
    const result = await this.databaseService.pool.query<UserRow>(
      `
      UPDATE users
      SET ic_character_name = $2,
          profile_image_url = $3,
          bank_account_id = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, discord_id, username, avatar_url, ic_character_name, profile_image_url, bank_account_id, role, suspended_at, suspended_reason, created_at, updated_at
      `,
      [input.userId, input.icCharacterName, input.profileImageUrl, input.bankAccountId],
    );

    if (!result.rowCount) {
      throw new Error('User not found for profile update');
    }

    return this.mapRow(result.rows[0]);
  }
  private mapRow(row: UserRow): AppUser {
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
