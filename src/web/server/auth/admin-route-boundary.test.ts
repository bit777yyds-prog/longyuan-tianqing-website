import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacy admin route boundary', () => {
  it('requires the shared administrator authorization guard', async () => {
    const layoutPath = resolve(process.cwd(), 'app/(admin)/layout.tsx');
    const source = await readFile(layoutPath, 'utf8');

    expect(source).toContain("import { requireAuthenticatedAdmin } from '@/server/auth/authorization'");
    expect(source).toContain('await requireAuthenticatedAdmin(await headers())');
    expect(source).toContain("redirect('/login')");
    expect(source).toContain("export const dynamic = 'force-dynamic'");
  });
});
