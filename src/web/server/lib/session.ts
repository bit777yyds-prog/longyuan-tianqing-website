import { createHmac } from 'node:crypto';
import { base64UrlDecode, base64UrlEncode, generateToken, safeEqual, sha256Hex } from './crypto';

export interface SessionToken {
  rawToken: string;
  tokenSha256: string;
  expiresAt: Date;
}

export interface SignedSessionPayload {
  actorId: string;
  userId: string;
  role: string;
  exp: number;
}

export function createSessionToken(now = new Date(), ttlSeconds = 60 * 60 * 24 * 7): SessionToken {
  const rawToken = generateToken(32);
  return {
    rawToken,
    tokenSha256: sha256Hex(rawToken),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
  };
}

export function signSession(payload: Omit<SignedSessionPayload, 'exp'>, secret: string, expiresAt: Date): string {
  const body: SignedSessionPayload = {
    ...payload,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedBody, secret);
  return `${encodedBody}.${signature}`;
}

export function verifySignedSession(token: string, secret: string, now = new Date()): SignedSessionPayload | null {
  const [encodedBody, signature] = token.split('.');
  if (!encodedBody || !signature) return null;
  if (!safeEqual(signature, sign(encodedBody, secret))) return null;

  const payload = JSON.parse(base64UrlDecode(encodedBody).toString('utf8')) as SignedSessionPayload;
  if (payload.exp <= Math.floor(now.getTime() / 1000)) return null;
  return payload;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}
