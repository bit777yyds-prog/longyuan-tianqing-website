import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { base64UrlDecode, base64UrlEncode } from './crypto';

const KEY_LENGTH = 64;
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  assertPasswordStrength(password);
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    base64UrlEncode(salt),
    base64UrlEncode(derived),
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, nValue, rValue, pValue, salt, hash] = storedHash.split('$');
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (scheme !== 'scrypt' || !isValidScryptCost(N, r, p) || !salt || !hash) return false;

  try {
    const saltBuffer = base64UrlDecode(salt);
    const expected = base64UrlDecode(hash);
    if (saltBuffer.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await deriveKey(password, saltBuffer, expected.length, N, r, p);

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function isValidScryptCost(N: number, r: number, p: number): boolean {
  return Number.isInteger(N) && N >= 16384 && N <= SCRYPT_N
    && (N & (N - 1)) === 0
    && Number.isInteger(r) && r > 0 && r <= SCRYPT_R
    && Number.isInteger(p) && p > 0 && p <= 4;
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  N: number,
  r: number,
  p: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { N, r, p, maxmem: SCRYPT_MAXMEM }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export function assertPasswordStrength(password: string): void {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters long');
  }
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/[0-9]/u.test(password)) {
    throw new Error('Password must include lowercase, uppercase, and number characters');
  }
}
