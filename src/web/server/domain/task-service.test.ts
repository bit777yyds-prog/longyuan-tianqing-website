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
      updateTaskStatus: vi.fn(),
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
      updateTaskStatus: vi.fn(),
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

  it('publishes drafts and closes open tasks', async () => {
    const repository: TaskRepository = {
      createTask: vi.fn(),
      listTasks: vi.fn(),
      findTask: vi.fn(async () => taskRecord({ status: 'draft' })),
      updateTaskStatus: vi.fn(async (_actorId, _id, status) => taskRecord({ status })),
    };

    const service = new TaskService(repository);
    await expect(service.updateTaskStatus('actor-id', 'task-id', 'open')).resolves.toMatchObject({ status: 'open' });

    vi.mocked(repository.findTask).mockResolvedValueOnce(taskRecord({ status: 'open' }));
    await expect(service.updateTaskStatus('actor-id', 'task-id', 'closed')).resolves.toMatchObject({ status: 'closed' });
  });

  it('rejects unsupported task status transitions', async () => {
    const repository: TaskRepository = {
      createTask: vi.fn(),
      listTasks: vi.fn(),
      findTask: vi.fn(async () => taskRecord({ status: 'draft' })),
      updateTaskStatus: vi.fn(),
    };

    await expect(new TaskService(repository).updateTaskStatus('actor-id', 'task-id', 'closed'))
      .rejects.toThrow('Task status transition is not supported');
    expect(repository.updateTaskStatus).not.toHaveBeenCalled();
  });
});

function taskRecord(input: { status: 'draft' | 'open' | 'closed' }) {
  return {
    id: 'task-id',
    title: '整理龙泉窑资料',
    project: '龙渊天青',
    type: '文献整理',
    deliverable: '结构化表格',
    deadline: '待定',
    reward: '按任务约定结算',
    status: input.status,
    slotsRemaining: 1,
    description: '整理公开资料',
    acceptanceCriteria: ['每条资料有出处'],
    aiRules: ['不得上传内部资料'],
    qualifications: ['能阅读文献'],
    faq: [],
    createdAt: new Date('2026-07-27T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-07-27T00:00:00.000Z').toISOString(),
  };
}
