import { describe, expect, it } from 'vitest';
import { createSessionToken, signSession, verifySignedSession } from './session';

describe('session helpers', () => {
  it('creates opaque tokens and signed session payloads', () => {
    const token = createSessionToken(new Date('2026-07-26T00:00:00.000Z'), 60);

    expect(token.rawToken).not.toEqual(token.tokenSha256);
    expect(token.expiresAt.toISOString()).toBe('2026-07-26T00:01:00.000Z');

    const signed = signSession(
      { actorId: 'actor-1', userId: 'user-1', role: 'admin' },
      'test-secret',
      token.expiresAt
    );

    expect(verifySignedSession(signed, 'test-secret', new Date('2026-07-26T00:00:30.000Z'))).toMatchObject({
      actorId: 'actor-1',
      userId: 'user-1',
      role: 'admin',
    });
    expect(verifySignedSession(signed, 'wrong-secret', new Date('2026-07-26T00:00:30.000Z'))).toBeNull();
    expect(verifySignedSession(signed, 'test-secret', new Date('2026-07-26T00:02:00.000Z'))).toBeNull();
  });
});
