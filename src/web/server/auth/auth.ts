import { createHash } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { createDatabaseClient, getDatabasePool } from '../db/client';
import { hashPassword, verifyPassword } from '../lib/password';
import { EncryptedPostgresSecondaryStorage } from './encrypted-secondary-storage';

let authInstance: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  const sessionSecret = requireSecret('SESSION_SECRET');
  const encryptionKey = requireSecret('ENCRYPTION_KEY');
  const db = createDatabaseClient();

  return betterAuth({
    appName: '龙渊天青',
    secret: sessionSecret,
    baseURL: process.env.APP_BASE_URL,
    trustedOrigins: buildTrustedOrigins(process.env.APP_BASE_URL),
    database: getDatabasePool(),
    secondaryStorage: new EncryptedPostgresSecondaryStorage(db, encryptionKey),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      password: {
        hash: hashPassword,
        verify: ({ password, hash }) => verifyPassword(password, hash),
      },
    },
    user: {
      modelName: 'app_users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      additionalFields: {
        actorId: { type: 'string', fieldName: 'actor_id', input: false },
        role: { type: 'string', input: false },
        status: { type: 'string', input: false },
      },
    },
    account: {
      modelName: 'auth_accounts',
      fields: {
        userId: 'user_id',
        accountId: 'account_id',
        providerId: 'provider_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: false,
    },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: process.env.APP_ENV === 'production',
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const result = await db.query<{ status: string }>(
              'SELECT status FROM app_users WHERE id = $1',
              [session.userId]
            );
            if (result.rows[0]?.status !== 'active') return false;
          },
          after: async (session) => {
            await db.query(
              `
                INSERT INTO auth_sessions (
                  id,
                  user_id,
                  actor_id,
                  session_token_sha256,
                  expires_at,
                  created_at,
                  ip_address,
                  user_agent
                )
                SELECT $1, u.id, u.actor_id, $2, $3, $4, $5::inet, $6
                FROM app_users u
                WHERE u.id = $7
              `,
              [
                session.id,
                sha256(session.token),
                session.expiresAt,
                session.createdAt,
                session.ipAddress || null,
                session.userAgent ?? null,
                session.userId,
              ]
            );
          },
        },
        update: {
          after: async (session) => {
            await db.query(
              `
                UPDATE auth_sessions
                SET expires_at = $2,
                    last_seen_at = now()
                WHERE session_token_sha256 = $1
              `,
              [sha256(session.token), session.expiresAt]
            );
          },
        },
        delete: {
          after: async (session) => {
            await db.query(
              `
                UPDATE auth_sessions
                SET revoked_at = COALESCE(revoked_at, now())
                WHERE session_token_sha256 = $1
              `,
              [sha256(session.token)]
            );
          },
        },
      },
    },
    plugins: [nextCookies()],
  });

}

export function getAuth(): ReturnType<typeof createAuth> {
  authInstance ??= createAuth();
  return authInstance;
}

function requireSecret(name: 'SESSION_SECRET' | 'ENCRYPTION_KEY'): string {
  const value = process.env[name];
  if (!value || value === 'change-me' || value.length < 32) {
    throw new Error(`${name} must contain at least 32 non-placeholder characters`);
  }
  return value;
}

function buildTrustedOrigins(baseURL: string | undefined): string[] {
  const origins = new Set<string>();
  if (baseURL) origins.add(new URL(baseURL).origin);

  if (process.env.APP_ENV !== 'production') {
    const port = baseURL ? new URL(baseURL).port || '3000' : '3000';
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }

  return [...origins];
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
