import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type WalletAccountRow = {
  id: string;
  account_identifier: string;
  wallet_code: string;
  balance: string;
};

type Queryable = {
  query: <T = unknown>(queryText: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: T[] }>;
};

@Injectable()
export class WalletRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureTables(): Promise<void> {
    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_accounts (
        id UUID PRIMARY KEY,
        account_identifier TEXT NOT NULL UNIQUE,
        wallet_code TEXT UNIQUE,
        balance NUMERIC(18,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_accounts
      ADD COLUMN IF NOT EXISTS wallet_code TEXT
    `);

    await this.databaseService.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_accounts_wallet_code_unique
      ON wallet_accounts(wallet_code)
      WHERE wallet_code IS NOT NULL
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY,
        wallet_account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        amount NUMERIC(18,2) NOT NULL,
        direction TEXT NOT NULL DEFAULT 'receive',
        status TEXT NOT NULL DEFAULT 'success',
        hash TEXT NOT NULL DEFAULT '',
        note TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_transactions
      ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'receive'
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_transactions
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success'
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_transactions
      ADD COLUMN IF NOT EXISTS hash TEXT NOT NULL DEFAULT ''
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_transactions
      ADD COLUMN IF NOT EXISTS note TEXT NULL
    `);

    await this.databaseService.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_account_created
      ON wallet_transactions(wallet_account_id, created_at DESC)
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_external_deposits (
        deposit_id TEXT PRIMARY KEY,
        wallet_account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
        account_identifier TEXT NOT NULL,
        wallet_code TEXT,
        amount NUMERIC(18,2) NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_external_deposits
      ADD COLUMN IF NOT EXISTS wallet_code TEXT
    `);

    await this.databaseService.pool.query(`
      UPDATE wallet_external_deposits d
      SET wallet_code = a.wallet_code
      FROM wallet_accounts a
      WHERE d.wallet_account_id = a.id
        AND (d.wallet_code IS NULL OR d.wallet_code = '')
    `);

    const walletsWithoutCode = await this.databaseService.pool.query<{ id: string }>(`
      SELECT id
      FROM wallet_accounts
      WHERE wallet_code IS NULL OR wallet_code = ''
      ORDER BY created_at ASC
    `);

    for (const wallet of walletsWithoutCode.rows) {
      await this.assignWalletCodeForWalletId(wallet.id);
    }

    await this.databaseService.pool.query(`
      UPDATE wallet_external_deposits d
      SET wallet_code = a.wallet_code
      FROM wallet_accounts a
      WHERE d.wallet_account_id = a.id
        AND (d.wallet_code IS NULL OR d.wallet_code = '')
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_accounts
      ALTER COLUMN wallet_code SET NOT NULL
    `);

    await this.databaseService.pool.query(`
      ALTER TABLE wallet_external_deposits
      ALTER COLUMN wallet_code SET NOT NULL
    `);

    await this.databaseService.pool.query(`
      CREATE OR REPLACE FUNCTION prevent_wallet_code_update()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.wallet_code IS DISTINCT FROM NEW.wallet_code THEN
          RAISE EXCEPTION 'wallet_code is immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await this.databaseService.pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'trg_wallet_code_immutable'
        ) THEN
          CREATE TRIGGER trg_wallet_code_immutable
          BEFORE UPDATE OF wallet_code ON wallet_accounts
          FOR EACH ROW
          EXECUTE FUNCTION prevent_wallet_code_update();
        END IF;
      END
      $$;
    `);

    await this.databaseService.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_external_deposits_account
      ON wallet_external_deposits(wallet_account_id, created_at DESC)
    `);
  }

  async findWalletAccountByIdentifier(accountIdentifier: string): Promise<{ id: string; walletCode: string; balance: string } | null> {
    const found = await this.databaseService.pool.query<WalletAccountRow>(
      `
      SELECT id, account_identifier, wallet_code, balance
      FROM wallet_accounts
      WHERE account_identifier = $1
      LIMIT 1
      `,
      [accountIdentifier],
    );

    if (!found.rowCount) {
      return null;
    }

    return {
      id: found.rows[0].id,
      walletCode: found.rows[0].wallet_code,
      balance: found.rows[0].balance,
    };
  }

  async findWalletAccountByWalletCode(walletCode: string): Promise<{ id: string; walletCode: string; balance: string } | null> {
    const found = await this.databaseService.pool.query<WalletAccountRow>(
      `
      SELECT id, account_identifier, wallet_code, balance
      FROM wallet_accounts
      WHERE wallet_code = $1
      LIMIT 1
      `,
      [walletCode],
    );

    if (!found.rowCount) {
      return null;
    }

    return {
      id: found.rows[0].id,
      walletCode: found.rows[0].wallet_code,
      balance: found.rows[0].balance,
    };
  }

  async findOrCreateWalletAccount(accountIdentifier: string): Promise<{ id: string; walletCode: string; balance: string }> {
    const now = new Date();
    const createId = randomUUID();
    const walletCode = await this.createUniqueWalletCode(this.databaseService.pool);

    const upsert = await this.databaseService.pool.query<WalletAccountRow>(
      `
      INSERT INTO wallet_accounts (id, account_identifier, wallet_code, balance, created_at, updated_at)
      VALUES ($1, $2, $3, 0, $4, $4)
      ON CONFLICT (account_identifier) DO NOTHING
      RETURNING id, account_identifier, wallet_code, balance
      `,
      [createId, accountIdentifier, walletCode, now],
    );

    if (upsert.rowCount && upsert.rows[0]) {
      return {
        id: upsert.rows[0].id,
        walletCode: upsert.rows[0].wallet_code,
        balance: upsert.rows[0].balance,
      };
    }

    const found = await this.databaseService.pool.query<WalletAccountRow>(
      `
      SELECT id, account_identifier, wallet_code, balance
      FROM wallet_accounts
      WHERE account_identifier = $1
      LIMIT 1
      `,
      [accountIdentifier],
    );

    if (!found.rowCount) {
      throw new Error('Wallet account not found after upsert');
    }

    return {
      id: found.rows[0].id,
      walletCode: found.rows[0].wallet_code,
      balance: found.rows[0].balance,
    };
  }

  async addBalance(
    walletAccountId: string,
    amount: number,
    kind: 'deposit' | 'withdrawal_revert' = 'deposit',
    meta?: { hash?: string; note?: string },
  ): Promise<string> {
    const client = await this.databaseService.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE wallet_accounts
        SET balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [amount, walletAccountId],
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (id, wallet_account_id, kind, amount, direction, status, hash, note, created_at)
        VALUES ($1, $2, $3, $4, 'receive', 'success', $5, $6, NOW())
        `,
        [
          randomUUID(),
          walletAccountId,
          kind,
          amount,
          meta?.hash?.trim() || randomUUID().replace(/-/g, ''),
          meta?.note ?? null,
        ],
      );

      const row = await client.query<{ balance: string }>(
        `SELECT balance FROM wallet_accounts WHERE id = $1 LIMIT 1`,
        [walletAccountId],
      );

      await client.query('COMMIT');
      return row.rows[0].balance;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async subtractBalance(walletAccountId: string, amount: number): Promise<{ ok: boolean; balance: string; txId?: string }> {
    const client = await this.databaseService.pool.connect();
    try {
      await client.query('BEGIN');

      const txId = randomUUID();

      const updated = await client.query<{ balance: string }>(
        `
        UPDATE wallet_accounts
        SET balance = balance - $1,
            updated_at = NOW()
        WHERE id = $2
          AND balance >= $1
        RETURNING balance
        `,
        [amount, walletAccountId],
      );

      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return { ok: false, balance: '0.00' };
      }

      await client.query(
        `
        INSERT INTO wallet_transactions (id, wallet_account_id, kind, amount, direction, status, hash, note, created_at)
        VALUES ($1, $2, 'withdrawal', $3, 'send', 'success', $4, NULL, NOW())
        `,
        [txId, walletAccountId, amount, randomUUID().replace(/-/g, '')],
      );

      await client.query('COMMIT');
      return { ok: true, balance: updated.rows[0].balance, txId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBalanceByAccountIdentifier(accountIdentifier: string): Promise<{ walletCode: string; balance: string }> {
    const account = await this.findOrCreateWalletAccount(accountIdentifier);
    return {
      walletCode: account.walletCode,
      balance: account.balance,
    };
  }

  async markTransactionFailed(transactionId: string, note: string): Promise<void> {
    await this.databaseService.pool.query(
      `
      UPDATE wallet_transactions
      SET status = 'failed',
          note = $2
      WHERE id = $1
      `,
      [transactionId, note],
    );
  }

  async listTransactionsByAccountIdentifier(accountIdentifier: string): Promise<
    Array<{
      id: string;
      hash: string;
      amount: number;
      timestamp: string;
      direction: 'send' | 'receive';
      status: 'success' | 'failed';
    }>
  > {
    const account = await this.findOrCreateWalletAccount(accountIdentifier);
    const rows = await this.databaseService.pool.query<{
      id: string;
      hash: string;
      amount: string;
      created_at: Date;
      direction: 'send' | 'receive';
      status: 'success' | 'failed';
    }>(
      `
      SELECT id, hash, amount, created_at, direction, status
      FROM wallet_transactions
      WHERE wallet_account_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [account.id],
    );

    return rows.rows.map((row: {
      id: string;
      hash: string;
      amount: string;
      created_at: Date;
      direction: 'send' | 'receive';
      status: 'success' | 'failed';
    }) => ({
      id: row.id,
      hash: row.hash || row.id.replace(/-/g, ''),
      amount: Number(row.amount),
      timestamp: row.created_at.toISOString(),
      direction: row.direction,
      status: row.status,
    }));
  }

  async ingestExternalDeposit(input: {
    walletCode: string;
    amount: number;
    depositId: string;
  }): Promise<
    | {
        status: 'accepted';
        idempotent: boolean;
        walletCode: string;
        newBalance: string;
      }
    | {
        status: 'conflict';
      }
    | {
        status: 'unknown_account';
      }
  > {
    const client = await this.databaseService.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query<{
        deposit_id: string;
        wallet_account_id: string;
        wallet_code: string;
        amount: string;
      }>(
        `
        SELECT deposit_id, wallet_account_id, wallet_code, amount
        FROM wallet_external_deposits
        WHERE deposit_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [input.depositId],
      );

      if (existing.rowCount && existing.rows[0]) {
        const samePayload = existing.rows[0].wallet_code === input.walletCode && Number(existing.rows[0].amount) === input.amount;

        if (samePayload) {
          const account = await client.query<{ balance: string }>(
            `
            SELECT balance
            FROM wallet_accounts
            WHERE id = $1
            LIMIT 1
            `,
            [existing.rows[0].wallet_account_id],
          );

          await client.query('COMMIT');
          return {
            status: 'accepted',
            idempotent: true,
            walletCode: existing.rows[0].wallet_code,
            newBalance: account.rows[0]?.balance ?? '0.00',
          };
        }

        await client.query(
          `
          INSERT INTO wallet_transactions (id, wallet_account_id, kind, amount, direction, status, hash, note, created_at)
          VALUES ($1, $2, 'deposit', $3, 'receive', 'failed', $4, $5, NOW())
          `,
          [
            randomUUID(),
            existing.rows[0].wallet_account_id,
            input.amount,
            input.depositId,
            'deposit_id_reused_with_different_payload',
          ],
        );

        await client.query('COMMIT');
        return { status: 'conflict' };
      }

      const account = await client.query<{ id: string; account_identifier: string; wallet_code: string; balance: string }>(
        `
        SELECT id, account_identifier, wallet_code, balance
        FROM wallet_accounts
        WHERE wallet_code = $1
        LIMIT 1
        FOR UPDATE
        `,
        [input.walletCode],
      );

      if (!account.rowCount || !account.rows[0]) {
        await client.query('COMMIT');
        return { status: 'unknown_account' };
      }

      await client.query(
        `
        UPDATE wallet_accounts
        SET balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [input.amount, account.rows[0].id],
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (id, wallet_account_id, kind, amount, direction, status, hash, note, created_at)
        VALUES ($1, $2, 'deposit', $3, 'receive', 'success', $4, $5, NOW())
        `,
        [randomUUID(), account.rows[0].id, input.amount, input.depositId, 'external_provider_deposit'],
      );

      await client.query(
        `
        INSERT INTO wallet_external_deposits (deposit_id, wallet_account_id, account_identifier, wallet_code, amount, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'success', NOW(), NOW())
        `,
        [
          input.depositId,
          account.rows[0].id,
          account.rows[0].account_identifier,
          account.rows[0].wallet_code,
          input.amount,
        ],
      );

      const updated = await client.query<{ balance: string }>(
        `
        SELECT balance
        FROM wallet_accounts
        WHERE id = $1
        LIMIT 1
        `,
        [account.rows[0].id],
      );

      await client.query('COMMIT');
      return {
        status: 'accepted',
        idempotent: false,
        walletCode: account.rows[0].wallet_code,
        newBalance: updated.rows[0]?.balance ?? '0.00',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private generateWalletCode(): string {
    const digits = randomInt(0, 10_000_000).toString().padStart(7, '0');
    return `FP-${digits}`;
  }

  private async createUniqueWalletCode(queryable: Queryable): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = this.generateWalletCode();
      const exists = await queryable.query<{ exists: number }>(
        `
        SELECT 1 as exists
        FROM wallet_accounts
        WHERE wallet_code = $1
        LIMIT 1
        `,
        [candidate],
      );
      if (!exists.rowCount) {
        return candidate;
      }
    }

    throw new Error('Could not generate unique wallet_code');
  }

  private async assignWalletCodeForWalletId(walletId: string): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const code = this.generateWalletCode();
      try {
        const updated = await this.databaseService.pool.query(
          `
          UPDATE wallet_accounts
          SET wallet_code = $2,
              updated_at = NOW()
          WHERE id = $1
            AND (wallet_code IS NULL OR wallet_code = '')
          `,
          [walletId, code],
        );

        if (updated.rowCount) {
          return;
        }

        return;
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError.code === '23505') {
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Could not backfill wallet_code for wallet ${walletId}`);
  }
}
