import { describe, expect, it, vi } from 'vitest';
import {
  DuplicateTaskApplicationError,
  normalizeApplicationMessage,
  TaskApplicationService,
  TaskNotOpenForApplicationsError,
  type TaskApplicationRepository,
} from './task-application-service';

describe('TaskApplicationService', () => {
  it('normalizes and creates a task application', async () => {
    const repository: TaskApplicationRepository = {
      createApplication: vi.fn(async (input) => ({
        id: 'application-id',
        taskId: input.taskId,
        taskTitle: '整理龙泉窑资料',
        applicantUserId: input.applicantUserId,
        applicantActorId: input.applicantActorId,
        applicantName: '申请人',
        applicantEmail: 'user@example.test',
        status: 'submitted' as const,
        message: input.message,
        createdAt: new Date('2026-07-28T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-07-28T00:00:00.000Z').toISOString(),
      })),
      listApplications: vi.fn(),
    };

    await expect(new TaskApplicationService(repository).createApplication({
      taskId: 'task-id',
      applicantUserId: 'user-id',
      applicantActorId: 'actor-id',
      message: ' 我有相关资料整理经验，可以按期交付。 ',
    })).resolves.toMatchObject({
      status: 'submitted',
      message: '我有相关资料整理经验，可以按期交付。',
    });
  });

  it('rejects short application messages', () => {
    expect(() => normalizeApplicationMessage('太短')).toThrow('Application message is too short');
  });

  it('propagates duplicate and closed-task errors from the repository', async () => {
    const duplicateRepository: TaskApplicationRepository = {
      createApplication: vi.fn(async () => {
        throw new DuplicateTaskApplicationError('duplicate');
      }),
      listApplications: vi.fn(),
    };
    await expect(new TaskApplicationService(duplicateRepository).createApplication({
      taskId: 'task-id',
      applicantUserId: 'user-id',
      applicantActorId: 'actor-id',
      message: '我可以完成这个任务并按时提交结果。',
    })).rejects.toBeInstanceOf(DuplicateTaskApplicationError);

    const closedRepository: TaskApplicationRepository = {
      createApplication: vi.fn(async () => {
        throw new TaskNotOpenForApplicationsError('closed');
      }),
      listApplications: vi.fn(),
    };
    await expect(new TaskApplicationService(closedRepository).createApplication({
      taskId: 'task-id',
      applicantUserId: 'user-id',
      applicantActorId: 'actor-id',
      message: '我可以完成这个任务并按时提交结果。',
    })).rejects.toBeInstanceOf(TaskNotOpenForApplicationsError);
  });
});
