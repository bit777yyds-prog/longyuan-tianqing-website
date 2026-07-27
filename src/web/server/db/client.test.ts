import { describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PgDatabaseClient } from './client';

function createPoolDouble() {
  const calls: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async () => ({ rows: [] })),
  } as unknown as Pool;

  return { calls, client, pool };
}

describe('PgDatabaseClient', () => {
  it('commits successful transactions and releases the connection', async () => {
    const { calls, client, pool } = createPoolDouble();
    const database = new PgDatabaseClient(pool);

    await expect(database.transaction(async (tx) => {
      await tx.query('SELECT 1');
      return 'done';
    })).resolves.toBe('done');

    expect(calls).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back failed transactions and releases the connection', async () => {
    const { calls, client, pool } = createPoolDouble();
    const database = new PgDatabaseClient(pool);

    await expect(database.transaction(async () => {
      throw new Error('write failed');
    })).rejects.toThrow('write failed');

    expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
