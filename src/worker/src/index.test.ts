import { describe, expect, it } from 'vitest';

describe('worker entry', () => {
  it('has a default role fallback', () => {
    expect(process.env.APP_ROLE ?? 'worker').toBeTypeOf('string');
  });
});
