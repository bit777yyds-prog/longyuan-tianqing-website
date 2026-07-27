import { describe, expect, it } from 'vitest';
import type { DatabaseClient, QueryResult } from '../db/database-client';
import { EncryptedPostgresSecondaryStorage } from './encrypted-secondary-storage';

class MemoryStorageClient implements DatabaseClient {
  rows = new Map<string, string>();

  async query<Row>(sql: string, params: unknown[] = []): Promise<QueryResult<Row>> {
    const key = String(params[0]);
    if (sql.includes('INSERT INTO auth_secondary_storage')) {
      this.rows.set(key, String(params[1]));
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM') && sql.includes('RETURNING')) {
      const value = this.rows.get(key);
      this.rows.delete(key);
      return { rows: value ? [{ encrypted_value: value } as Row] : [] };
    }
    if (sql.includes('DELETE FROM')) {
      this.rows.delete(key);
      return { rows: [] };
    }
    const value = this.rows.get(key);
    return { rows: value ? [{ encrypted_value: value } as Row] : [] };
  }
}

describe('EncryptedPostgresSecondaryStorage', () => {
  it('stores only a hashed key and encrypted value', async () => {
    const db = new MemoryStorageClient();
    const storage = new EncryptedPostgresSecondaryStorage(db, 'a-secure-encryption-key-with-32-chars');

    await storage.set('raw-session-token', '{"userId":"user-1"}', 60);

    const [[storedKey, storedValue]] = Array.from(db.rows.entries());
    expect(storedKey).not.toContain('raw-session-token');
    expect(storedValue).not.toContain('user-1');
    await expect(storage.get('raw-session-token')).resolves.toBe('{"userId":"user-1"}');
  });

  it('atomically consumes one-time values', async () => {
    const db = new MemoryStorageClient();
    const storage = new EncryptedPostgresSecondaryStorage(db, 'a-secure-encryption-key-with-32-chars');
    await storage.set('verification-token', 'value');

    await expect(storage.getAndDelete('verification-token')).resolves.toBe('value');
    await expect(storage.get('verification-token')).resolves.toBeNull();
  });
});
