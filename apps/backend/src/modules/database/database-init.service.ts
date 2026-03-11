import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        discord_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        avatar_url TEXT NULL,
        ic_character_name TEXT NULL,
        profile_image_url TEXT NULL,
        bank_account_id TEXT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS ic_character_name TEXT NULL
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_image_url TEXT NULL
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bank_account_id TEXT NULL
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS suspended_reason TEXT NULL
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL,
        replaced_by_session_id UUID NULL
      )
    `);

    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions(user_id)',
    );

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_exchange_codes (
        code_hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_auth_exchange_codes_expires_at ON auth_exchange_codes(expires_at)',
    );

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id UUID PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content JSONB NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        published_at TIMESTAMPTZ NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS news_home_slots (
        slot TEXT PRIMARY KEY CHECK (slot IN ('primary', 'secondary', 'third')),
        article_id UUID NOT NULL UNIQUE REFERENCES news_articles(id) ON DELETE CASCADE,
        updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS user_moderation_events (
        id UUID PRIMARY KEY,
        target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL CHECK (event_type IN ('role_changed', 'suspended', 'restored')),
        previous_role TEXT NULL,
        new_role TEXT NULL,
        reason TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_news_articles_status_created_at ON news_articles(status, created_at DESC)',
    );
    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_news_articles_slug ON news_articles(slug)',
    );
    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)',
    );
    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at ON audit_logs(actor_user_id, created_at DESC)',
    );
    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_user_moderation_events_target_created_at ON user_moderation_events(target_user_id, created_at DESC)',
    );
  }
}
