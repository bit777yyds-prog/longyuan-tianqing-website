import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SecondaryStorage } from 'better-auth';
import type { DatabaseClient } from '../db/database-client';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

interface StorageRow {
  encrypted_value: string;
}

export class EncryptedPostgresSecondaryStorage implements SecondaryStorage {
  private readonly encryptionKey: Buffer;

  constructor(private readonly db: DatabaseClient, secret: string) {
    if (secret.length < 32) {
      throw new Error('ENCRYPTION_KEY must contain at least 32 characters');
    }
    this.encryptionKey = createHash('sha256').update(secret, 'utf8').digest();
  }

  async get(key: string): Promise<string | null> {
    const result = await this.db.query<StorageRow>(
      `
        SELECT encrypted_value
        FROM auth_secondary_storage
        WHERE key_sha256 = $1
          AND (expires_at IS NULL OR expires_at > now())
      `,
      [digestKey(key)]
    );
    return result.rows[0] ? this.decrypt(result.rows[0].encrypted_value) : null;
  }

  async getAndDelete(key: string): Promise<string | null> {
    const result = await this.db.query<StorageRow>(
      `
        WITH deleted AS (
          DELETE FROM auth_secondary_storage
          WHERE key_sha256 = $1
            AND (expires_at IS NULL OR expires_at > now())
          RETURNING encrypted_value
        ), revoked AS (
          UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, now())
          WHERE session_token_sha256 = $1
          RETURNING id
        )
        SELECT encrypted_value FROM deleted
      `,
      [digestKey(key)]
    );
    return result.rows[0] ? this.decrypt(result.rows[0].encrypted_value) : null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.db.query(
      `
        INSERT INTO auth_secondary_storage (
          key_sha256,
          encrypted_value,
          expires_at
        )
        VALUES ($1, $2, CASE WHEN $3::integer IS NULL THEN NULL ELSE now() + ($3 * interval '1 second') END)
        ON CONFLICT (key_sha256) DO UPDATE
        SET encrypted_value = EXCLUDED.encrypted_value,
            expires_at = EXCLUDED.expires_at,
            updated_at = now()
      `,
      [digestKey(key), this.encrypt(value), ttl ?? null]
    );
  }

  async delete(key: string): Promise<void> {
    await this.db.query(
      `
        WITH deleted AS (
          DELETE FROM auth_secondary_storage
          WHERE key_sha256 = $1
        )
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, now())
        WHERE session_token_sha256 = $1
      `,
      [digestKey(key)]
    );
  }

  private encrypt(value: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  }

  private decrypt(value: string): string {
    const payload = Buffer.from(value, 'base64url');
    if (payload.length <= IV_BYTES + TAG_BYTES) throw new Error('Invalid encrypted auth value');
    const iv = payload.subarray(0, IV_BYTES);
    const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}

function digestKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}
