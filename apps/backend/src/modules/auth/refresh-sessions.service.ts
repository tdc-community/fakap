import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RefreshSessionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createSession(input: { userId: string; refreshToken: string; expiresAt: Date }): Promise<void> {
    const tokenHash = this.hashToken(input.refreshToken);
    await this.databaseService.pool.query(
      `
      INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at, replaced_by_session_id)
      VALUES ($1, $2, $3, $4, NULL, $5, NULL)
      `,
      [randomUUID(), input.userId, tokenHash, input.expiresAt, new Date()],
    );
  }

  async rotateSession(input: {
    previousRefreshToken: string;
    newRefreshToken: string;
    userId: string;
    newExpiresAt: Date;
  }): Promise<void> {
    const previousHash = this.hashToken(input.previousRefreshToken);
    const newHash = this.hashToken(input.newRefreshToken);
    const now = new Date();
    const newSessionId = randomUUID();

    const update = await this.databaseService.pool.query(
      `
      UPDATE refresh_sessions
      SET revoked_at = $1, replaced_by_session_id = $2
      WHERE token_hash = $3
        AND user_id = $4
        AND revoked_at IS NULL
        AND expires_at > $1
      `,
      [now, newSessionId, previousHash, input.userId],
    );

    if (update.rowCount === 0) {
      throw new Error('Refresh session not active');
    }

    await this.databaseService.pool.query(
      `
      INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at, replaced_by_session_id)
      VALUES ($1, $2, $3, $4, NULL, $5, NULL)
      `,
      [newSessionId, input.userId, newHash, input.newExpiresAt, now],
    );
  }

  async revokeSession(input: { refreshToken: string; userId: string }): Promise<void> {
    const tokenHash = this.hashToken(input.refreshToken);
    await this.databaseService.pool.query(
      `
      UPDATE refresh_sessions
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND user_id = $2
        AND revoked_at IS NULL
      `,
      [tokenHash, input.userId],
    );
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.databaseService.pool.query(
      `
      UPDATE refresh_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId],
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
