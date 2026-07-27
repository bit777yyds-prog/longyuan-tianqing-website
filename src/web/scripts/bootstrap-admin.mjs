import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
const KEY_LENGTH = 64;

const databaseUrl = process.env.DATABASE_URL ?? process.env.WEB_DATABASE_URL;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!databaseUrl || !email || !name || !password) {
  fail('DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD are required');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail('BOOTSTRAP_ADMIN_EMAIL is invalid');
assertPasswordStrength(password);

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('longyuan.bootstrap-admin'))");

  const existing = await client.query(
    "SELECT id FROM app_users WHERE role = 'admin' AND status = 'active' LIMIT 1"
  );
  if (existing.rows[0]) fail('An active administrator already exists; bootstrap is disabled');

  const duplicate = await client.query('SELECT id FROM app_users WHERE email = $1', [email]);
  if (duplicate.rows[0]) fail('An account with this email already exists');

  const passwordHash = await hashPassword(password);
  const actor = await client.query(
    `
      INSERT INTO actors (actor_type, display_name, email)
      VALUES ('human', $1, $2)
      RETURNING id
    `,
    [name, email]
  );
  const user = await client.query(
    `
      INSERT INTO app_users (actor_id, name, email, email_verified, role, status)
      VALUES ($1, $2, $3, TRUE, 'admin', 'active')
      RETURNING id
    `,
    [actor.rows[0].id, name, email]
  );
  await client.query(
    `
      INSERT INTO auth_accounts (user_id, account_id, provider_id, password)
      VALUES ($1, $2, 'credential', $3)
    `,
    [user.rows[0].id, email, passwordHash]
  );
  await client.query(
    `
      INSERT INTO audit_logs (actor_id, action, object_type, object_id, after_data)
      VALUES ($1, 'user.bootstrap_admin', 'app_user', $2, $3::jsonb)
    `,
    [actor.rows[0].id, user.rows[0].id, JSON.stringify({ email, role: 'admin' })]
  );
  await client.query('COMMIT');
  console.log(`Bootstrap administrator created: ${email}`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

async function hashPassword(value) {
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

function assertPasswordStrength(value) {
  if (value.length < 12 || !/[a-z]/u.test(value) || !/[A-Z]/u.test(value) || !/[0-9]/u.test(value)) {
    fail('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters and include upper/lowercase letters and a number');
  }
}

function fail(message) {
  throw new Error(message);
}
