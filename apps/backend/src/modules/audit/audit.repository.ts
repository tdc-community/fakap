import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuditLogRecord, CreateAuditLogInput } from './audit.types';

type AuditLogRow = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
};

@Injectable()
export class AuditRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const id = randomUUID();
    const createdAt = new Date();
    const result = await this.databaseService.pool.query<AuditLogRow>(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING id, actor_user_id, action, target_type, target_id, payload, created_at
      `,
      [id, input.actorUserId, input.action, input.targetType, input.targetId, JSON.stringify(input.payload), createdAt],
    );

    return this.mapRow(result.rows[0]);
  }

  async listRecent(limit: number): Promise<AuditLogRecord[]> {
    const cappedLimit = Math.max(1, Math.min(limit, 100));
    const result = await this.databaseService.pool.query<AuditLogRow>(
      `
      SELECT id, actor_user_id, action, target_type, target_id, payload, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [cappedLimit],
    );

    return result.rows.map((row: AuditLogRow) => this.mapRow(row));
  }

  private mapRow(row: AuditLogRow): AuditLogRecord {
    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      payload: row.payload,
      createdAt: row.created_at.toISOString(),
    };
  }
}
