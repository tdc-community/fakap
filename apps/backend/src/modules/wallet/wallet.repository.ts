import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WalletRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureTables(): Promise<void> {
    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_accounts (
        id UUID PRIMARY KEY,
        account_identifier TEXT NOT NULL UNIQUE,
        balance NUMERIC(18,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
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
        amount NUMERIC(18,2) NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_external_deposits_account
      ON wallet_external_deposits(wallet_account_id, created_at DESC)
    `);
  }

  async findWalletAccountByIdentifier(accountIdentifier: string): Promise<{ id: string; accountIdentifier: string; balance: string } | null> {
    const found = await this.databaseService.pool.query<{
      id: string;
      account_identifier: string;
      balance: string;
    }>(
      `
      SELECT id, account_identifier, balance
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
      accountIdentifier: found.rows[0].account_identifier,
      balance: found.rows[0].balance,
    };
  }

  async findOrCreateWalletAccount(accountIdentifier: string): Promise<{ id: string; accountIdentifier: string; balance: string }> {
    const now = new Date();
    const createId = randomUUID();

    const upsert = await this.databaseService.pool.query<{
      id: string;
      account_identifier: string;
      balance: string;
    }>(
      `
      INSERT INTO wallet_accounts (id, account_identifier, balance, created_at, updated_at)
      VALUES ($1, $2, 0, $3, $3)
      ON CONFLICT (account_identifier) DO NOTHING
      RETURNING id, account_identifier, balance
      `,
      [createId, accountIdentifier, now],
    );

    if (upsert.rowCount && upsert.rows[0]) {
      return {
        id: upsert.rows[0].id,
        accountIdentifier: upsert.rows[0].account_identifier,
        balance: upsert.rows[0].balance,
      };
    }

    const found = await this.databaseService.pool.query<{
      id: string;
      account_identifier: string;
      balance: string;
    }>(
      `
      SELECT id, account_identifier, balance
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
      accountIdentifier: found.rows[0].account_identifier,
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

  async getBalanceByAccountIdentifier(accountIdentifier: string): Promise<{ accountIdentifier: string; balance: string }> {
    const account = await this.findOrCreateWalletAccount(accountIdentifier);
    return {
      accountIdentifier: account.accountIdentifier,
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
    accountIdentifier: string;
    amount: number;
    depositId: string;
  }): Promise<
    | {
        status: 'accepted';
        idempotent: boolean;
        accountIdentifier: string;
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
        account_identifier: string;
        amount: string;
      }>(
        `
        SELECT deposit_id, wallet_account_id, account_identifier, amount
        FROM wallet_external_deposits
        WHERE deposit_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [input.depositId],
      );

      if (existing.rowCount && existing.rows[0]) {
        const samePayload =
          existing.rows[0].account_identifier === input.accountIdentifier && Number(existing.rows[0].amount) === input.amount;

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
            accountIdentifier: existing.rows[0].account_identifier,
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

      const account = await client.query<{ id: string; balance: string }>(
        `
        SELECT id, balance
        FROM wallet_accounts
        WHERE account_identifier = $1
        LIMIT 1
        FOR UPDATE
        `,
        [input.accountIdentifier],
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
        INSERT INTO wallet_external_deposits (deposit_id, wallet_account_id, account_identifier, amount, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'success', NOW(), NOW())
        `,
        [input.depositId, account.rows[0].id, input.accountIdentifier, input.amount],
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
        accountIdentifier: input.accountIdentifier,
        newBalance: updated.rows[0]?.balance ?? '0.00',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
