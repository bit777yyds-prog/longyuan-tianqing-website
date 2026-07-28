import { TaskStatus } from '@longyuan/shared';
import {
  NormalizedCreateTaskInput,
  NormalizedUpdateDraftTaskInput,
  TaskRecord,
  TaskRepository,
} from '../domain/task-service';
import { TransactionalDatabaseClient } from './database-client';

interface TaskRow {
  id: string;
  title: string;
  project_name: string;
  description: string | null;
  task_type: string;
  status: string;
  delivery_deadline: Date | null;
  acceptance_criteria: Record<string, unknown>;
  compensation: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export class SqlTaskRepository implements TaskRepository {
  constructor(private readonly db: TransactionalDatabaseClient) {}

  async createTask(actorId: string, input: NormalizedCreateTaskInput): Promise<TaskRecord> {
    return this.db.transaction(async (tx) => {
      const projectId = await getOrCreateProjectId(tx, actorId, input.projectName);

      const result = await tx.query<TaskRow>(
        `
          INSERT INTO tasks (
            project_id,
            title,
            description,
            task_type,
            status,
            publisher_actor_id,
            owner_actor_id,
            delivery_deadline,
            acceptance_criteria,
            compensation
          )
          VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8::jsonb, $9::jsonb)
          RETURNING
            tasks.*,
            (SELECT name FROM projects WHERE id = tasks.project_id) AS project_name
        `,
        [
          projectId,
          input.title,
          input.description,
          input.taskType,
          input.status,
          actorId,
          input.deliveryDeadline ? new Date(input.deliveryDeadline) : null,
          JSON.stringify({
            deliverable: input.deliverable,
            items: input.acceptanceCriteria,
            aiRules: input.aiRules,
            qualifications: input.qualifications,
            slotsTotal: input.slotsTotal,
          }),
          JSON.stringify({ summary: input.reward }),
        ]
      );

      const task = mapTask(result.rows[0]);
      await tx.query(
        `
          INSERT INTO audit_logs (actor_id, action, object_type, object_id, after_data)
          VALUES ($1, 'task.created', 'task', $2, $3::jsonb)
        `,
        [actorId, task.id, JSON.stringify({ status: task.status, title: task.title })]
      );
      return task;
    });
  }

  async listTasks(input: { includeDrafts: boolean }): Promise<TaskRecord[]> {
    const result = await this.db.query<TaskRow>(
      `
        SELECT t.*, p.name AS project_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE ($1::boolean OR t.status = 'open')
        ORDER BY t.created_at DESC
        LIMIT 500
      `,
      [input.includeDrafts]
    );
    return result.rows.map(mapTask);
  }

  async findTask(id: string, input: { includeDrafts: boolean }): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `
        SELECT t.*, p.name AS project_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.id = $1
          AND ($2::boolean OR t.status = 'open')
        LIMIT 1
      `,
      [id, input.includeDrafts]
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async updateTaskStatus(actorId: string, id: string, status: TaskRecord['status']): Promise<TaskRecord | null> {
    return this.db.transaction(async (tx) => {
      const currentResult = await tx.query<TaskRow>(
        `
          SELECT t.*, p.name AS project_name
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          WHERE t.id = $1
          FOR UPDATE
        `,
        [id]
      );
      if (!currentResult.rows[0]) return null;

      const currentTask = mapTask(currentResult.rows[0]);
      if (currentTask.status === status) return currentTask;
      assertTaskStatusTransition(currentTask.status, status);
      await assertTaskCanReopen(tx, currentTask.id, currentTask.status, status);

      const result = await tx.query<TaskRow>(
        `
          UPDATE tasks
          SET status = $2, updated_at = now()
          WHERE id = $1
          RETURNING
            tasks.*,
            (SELECT name FROM projects WHERE id = tasks.project_id) AS project_name
        `,
        [id, status]
      );
      if (!result.rows[0]) return null;

      const task = mapTask(result.rows[0]);
      await tx.query(
        `
          INSERT INTO audit_logs (actor_id, action, object_type, object_id, after_data)
          VALUES ($1, 'task.status_changed', 'task', $2, $3::jsonb)
        `,
        [actorId, task.id, JSON.stringify({ status: task.status, title: task.title })]
      );
      return task;
    });
  }

  async updateDraftTask(actorId: string, id: string, input: NormalizedUpdateDraftTaskInput): Promise<TaskRecord | null> {
    return this.db.transaction(async (tx) => {
      const draftTask = await tx.query<{ id: string }>(
        'SELECT id FROM tasks WHERE id = $1 AND status = $2 FOR UPDATE',
        [id, TaskStatus.DRAFT]
      );
      if (!draftTask.rows[0]) return null;

      const projectId = await getOrCreateProjectId(tx, actorId, input.projectName);
      const result = await tx.query<TaskRow>(
        `
          UPDATE tasks
          SET
            project_id = $2,
            title = $3,
            description = $4,
            task_type = $5,
            delivery_deadline = $6,
            acceptance_criteria = $7::jsonb,
            compensation = $8::jsonb,
            updated_at = now()
          WHERE id = $1
            AND status = 'draft'
          RETURNING
            tasks.*,
            (SELECT name FROM projects WHERE id = tasks.project_id) AS project_name
        `,
        [
          id,
          projectId,
          input.title,
          input.description,
          input.taskType,
          input.deliveryDeadline ? new Date(input.deliveryDeadline) : null,
          JSON.stringify({
            deliverable: input.deliverable,
            items: input.acceptanceCriteria,
            aiRules: input.aiRules,
            qualifications: input.qualifications,
            slotsTotal: input.slotsTotal,
          }),
          JSON.stringify({ summary: input.reward }),
        ]
      );
      if (!result.rows[0]) return null;

      const task = mapTask(result.rows[0]);
      await tx.query(
        `
          INSERT INTO audit_logs (actor_id, action, object_type, object_id, after_data)
          VALUES ($1, 'task.updated', 'task', $2, $3::jsonb)
        `,
        [actorId, task.id, JSON.stringify({ status: task.status, title: task.title })]
      );
      return task;
    });
  }
}

async function getOrCreateProjectId(
  tx: { query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> },
  actorId: string,
  projectName: string
): Promise<string> {
  const existingProject = await tx.query<{ id: string }>(
    'SELECT id FROM projects WHERE name = $1 AND status = $2 ORDER BY created_at ASC LIMIT 1',
    [projectName, 'active']
  );
  const project = existingProject.rows[0] ?? (await tx.query<{ id: string }>(
    `
      INSERT INTO projects (name, description, owner_actor_id, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id
    `,
    [projectName, `${projectName} 任务项目`, actorId]
  )).rows[0];

  if (!project?.id) throw new Error('Project could not be created');
  return project.id;
}

function mapTask(row: TaskRow): TaskRecord {
  const criteria = row.acceptance_criteria ?? {};
  const compensation = row.compensation ?? {};
  const slotsTotal = getNumber(criteria.slotsTotal, 1);
  return {
    id: row.id,
    title: row.title,
    project: row.project_name,
    type: row.task_type,
    deliverable: getString(criteria.deliverable, '按任务说明提交交付物'),
    deadline: row.delivery_deadline?.toISOString().slice(0, 10) ?? '待定',
    reward: getString(compensation.summary, '按任务约定结算'),
    status: toTaskStatus(row.status),
    slotsRemaining: slotsTotal,
    description: row.description ?? '',
    acceptanceCriteria: getStringList(criteria.items),
    aiRules: getStringList(criteria.aiRules),
    qualifications: getStringList(criteria.qualifications),
    faq: [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function toTaskStatus(value: string): TaskRecord['status'] {
  if (Object.values(TaskStatus).includes(value as TaskRecord['status'])) {
    return value as TaskRecord['status'];
  }
  return TaskStatus.DRAFT;
}

function assertTaskStatusTransition(current: TaskRecord['status'], next: TaskRecord['status']): void {
  const allowed: Record<string, TaskRecord['status'][]> = {
    [TaskStatus.DRAFT]: [TaskStatus.OPEN],
    [TaskStatus.OPEN]: [TaskStatus.CLOSED],
    [TaskStatus.CLOSED]: [TaskStatus.OPEN],
  };
  if (!allowed[current]?.includes(next)) {
    throw new Error('Task status transition is not supported');
  }
}

async function assertTaskCanReopen(
  tx: { query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> },
  taskId: string,
  current: TaskRecord['status'],
  next: TaskRecord['status']
): Promise<void> {
  if (current !== TaskStatus.CLOSED || next !== TaskStatus.OPEN) return;
  const activeAssignments = await tx.query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM task_assignments
      WHERE task_id = $1
        AND status IN ('assigned','in_progress')
    `,
    [taskId]
  );
  if (Number(activeAssignments.rows[0]?.count ?? 0) > 0) {
    throw new Error('Task status transition is not supported');
  }
}
