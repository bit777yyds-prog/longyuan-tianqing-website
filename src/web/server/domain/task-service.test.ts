import { describe, expect, it, vi } from 'vitest';
import { TaskService, type TaskRepository } from './task-service';

describe('TaskService', () => {
  it('normalizes and creates a task', async () => {
    const repository: TaskRepository = {
      createTask: vi.fn(async (_actorId, input) => ({
        id: 'task-id',
        title: input.title,
        project: input.projectName,
        type: input.taskType,
        deliverable: input.deliverable,
        deadline: input.deliveryDeadline ?? '待定',
        reward: input.reward,
        status: input.status,
        slotsRemaining: input.slotsTotal,
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        aiRules: input.aiRules,
        qualifications: input.qualifications,
        faq: [],
        createdAt: new Date('2026-07-27T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-07-27T00:00:00.000Z').toISOString(),
      })),
      listTasks: vi.fn(),
      findTask: vi.fn(),
    };

    const task = await new TaskService(repository).createTask('actor-id', {
      title: ' 整理龙泉窑资料 ',
      projectName: ' 龙渊天青 ',
      description: '整理公开资料',
      taskType: '文献整理',
      deliverable: '结构化表格',
      deliveryDeadline: '2026-08-01',
      reward: '',
      slotsTotal: 2,
      status: 'open',
      acceptanceCriteria: [' 每条资料有出处 ', ''],
      aiRules: ['不得上传内部资料'],
      qualifications: ['能阅读文献'],
    });

    expect(task).toMatchObject({
      title: '整理龙泉窑资料',
      project: '龙渊天青',
      reward: '按任务约定结算',
      slotsRemaining: 2,
      acceptanceCriteria: ['每条资料有出处'],
    });
  });

  it('rejects published tasks without acceptance criteria', async () => {
    const repository = {
      createTask: vi.fn(),
      listTasks: vi.fn(),
      findTask: vi.fn(),
    };

    expect(() => new TaskService(repository).createTask('actor-id', {
      title: '任务',
      projectName: '项目',
      description: '说明',
      taskType: '文献整理',
      deliverable: '表格',
      status: 'open',
      acceptanceCriteria: [],
      aiRules: ['可辅助'],
      qualifications: ['认真'],
    })).toThrow('Acceptance criteria');
  });
});
