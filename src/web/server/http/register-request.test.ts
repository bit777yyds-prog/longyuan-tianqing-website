import { describe, expect, it } from 'vitest';
import { parseRegisterRequest } from './register-request';

describe('parseRegisterRequest', () => {
  it('maps a valid JSON body to registration input', () => {
    expect(parseRegisterRequest({
      token: 'raw-token',
      email: 'user@example.com',
      displayName: 'Long Yuan User',
      password: 'Longyuan2026Pass',
    })).toEqual({
      rawInvitationToken: 'raw-token',
      email: 'user@example.com',
      displayName: 'Long Yuan User',
      password: 'Longyuan2026Pass',
    });
  });

  it('rejects missing or non-string fields', () => {
    expect(() => parseRegisterRequest(null)).toThrow('JSON object');
    expect(() => parseRegisterRequest({ token: 'raw-token' })).toThrow('email is required');
    expect(() => parseRegisterRequest({
      token: 'raw-token',
      email: 'user@example.com',
      displayName: 'User',
      password: 123,
    })).toThrow('password is required');
  });
});
