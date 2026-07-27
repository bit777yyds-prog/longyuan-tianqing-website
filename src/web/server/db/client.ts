import { Pool, PoolClient } from 'pg';
import { DatabaseClient, QueryResult, TransactionalDatabaseClient } from './database-client';

const globalForDatabase = globalThis as typeof globalThis & {
  longyuanPgPool?: Pool;
};

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export function createDatabaseClient(): TransactionalDatabaseClient {
  return new PgDatabaseClient(getDatabasePool());
}

export class PgDatabaseClient implements TransactionalDatabaseClient {
  constructor(private readonly pool: Pool) {}

  async query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as Row[] };
  }

  async transaction<T>(callback: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(new PgTransactionClient(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

class PgTransactionClient implements DatabaseClient {
  constructor(private readonly client: PoolClient) {}

  async query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    const result = await this.client.query(sql, params);
    return { rows: result.rows as Row[] };
  }
}

export function getDatabasePool(): Pool {
  if (globalForDatabase.longyuanPgPool) return globalForDatabase.longyuanPgPool;

  const connectionString = process.env.DATABASE_URL ?? process.env.WEB_DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseConfigurationError('DATABASE_URL or WEB_DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  globalForDatabase.longyuanPgPool = pool;
  return pool;
}
