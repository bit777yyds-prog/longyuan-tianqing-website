import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('hashes and verifies passwords without storing raw input', async () => {
    const hash = await hashPassword('Longyuan2026Pass');

    expect(hash.split('$').slice(0, 4)).toEqual(['scrypt', '131072', '8', '1']);
    expect(hash).not.toContain('Longyuan2026Pass');
    await expect(verifyPassword('Longyuan2026Pass', hash)).resolves.toBe(true);
    await expect(verifyPassword('Wrong2026Pass', hash)).resolves.toBe(false);
  });

  it('rejects malformed or unsafe cost parameters', async () => {
    await expect(
      verifyPassword('Longyuan2026Pass', 'scrypt$999999999$8$1$salt$hash')
    ).resolves.toBe(false);
    await expect(
      verifyPassword('Longyuan2026Pass', 'scrypt$131072$8$1$bad')
    ).resolves.toBe(false);
  });

  it('rejects weak passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow('at least 12');
    await expect(hashPassword('longyuan-password')).rejects.toThrow('lowercase, uppercase, and number');
  });
});
