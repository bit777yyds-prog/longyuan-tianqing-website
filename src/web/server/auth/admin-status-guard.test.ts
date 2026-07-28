import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('administrator status guard', () => {
  it('serializes status changes before checking the active administrator invariant', async () => {
    const routePath = resolve(process.cwd(), 'app/api/users/[id]/route.ts');
    const source = await readFile(routePath, 'utf8');

    expect(source).toContain("pg_advisory_xact_lock(hashtext('longyuan.admin-status-guard'))");
    expect(source.indexOf('pg_advisory_xact_lock')).toBeLessThan(source.indexOf("WHERE role = 'admin' AND status = 'active'"));
    expect(source).toContain('ORDER BY id');
    expect(source).toContain('FOR UPDATE');
  });
});
