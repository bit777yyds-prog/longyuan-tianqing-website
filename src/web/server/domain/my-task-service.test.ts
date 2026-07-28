import { describe, expect, it, vi } from 'vitest';
import { TaskStatus } from '@longyuan/shared';
import { MyTaskService, type MyTaskRepository } from './my-task-service';

describe('MyTaskService', () => {
  it('loads the dashboard for the current actor', async () => {
    const repository: MyTaskRepository = {
      listDashboard: vi.fn(async (actorId) => ({
        assignedTasks: [
          {
            assignmentId: 'assignment-id',
            assignmentStatus: 'assigned',
            assignedAt: '2026-07-28T00:00:00.000Z',
            task: {
              id: 'task-id',
              title: '整理资料',
              project: '龙渊天青',
              type: '文献整理',
              deliverable: '表格',
              deadline: '待定',
              reward: '按任务约定结算',
              status: TaskStatus.ASSIGNED,
              description: '说明',
              acceptanceCriteria: ['有出处'],
              aiRules: ['可辅助'],
              qualifications: ['认真'],
            },
          },
        ],
        applications: [],
        summary: { assigned: actorId === 'actor-id' ? 1 : 0, inProgress: 0, underReview: 0, rework: 0 },
      })),
      findAssignedTask: vi.fn(),
    };

    await expect(new MyTaskService(repository).listDashboard('actor-id')).resolves.toMatchObject({
      summary: { assigned: 1 },
      assignedTasks: [{ task: { id: 'task-id' } }],
    });
    expect(repository.listDashboard).toHaveBeenCalledWith('actor-id');
  });
});
