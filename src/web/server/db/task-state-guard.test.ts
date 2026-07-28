import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('task state guards', () => {
  it('locks and validates task status transitions inside the repository transaction', async () => {
    const repositoryPath = resolve(process.cwd(), 'server/db/task-repository.ts');
    const source = await readFile(repositoryPath, 'utf8');
    const updateTaskStatus = source.slice(source.indexOf('async updateTaskStatus'));

    expect(updateTaskStatus).toContain('FOR UPDATE');
    expect(updateTaskStatus.indexOf('assertTaskStatusTransition')).toBeLessThan(updateTaskStatus.indexOf('UPDATE tasks'));
    expect(updateTaskStatus).toContain('assertTaskCanReopen');
    expect(updateTaskStatus).toContain("[TaskStatus.DRAFT]: [TaskStatus.OPEN]");
    expect(updateTaskStatus).toContain("[TaskStatus.OPEN]: [TaskStatus.CLOSED]");
    expect(updateTaskStatus).toContain("[TaskStatus.CLOSED]: [TaskStatus.OPEN]");
  });

  it('rejects sibling submitted applications when one application is accepted', async () => {
    const repositoryPath = resolve(process.cwd(), 'server/db/task-application-repository.ts');
    const source = await readFile(repositoryPath, 'utf8');

    expect(source).toContain('WITH rejected AS');
    expect(source).toContain("AND id <> $2");
    expect(source).toContain("AND status = 'submitted'");
    expect(source).toContain("'reason', 'task_assigned'");
  });
});
