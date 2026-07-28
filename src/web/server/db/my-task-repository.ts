import { TaskStatus } from '@longyuan/shared';
import type {
  MyAssignedTaskRecord,
  MyTaskApplicationRecord,
  MyTaskDashboard,
  MyTaskRepository,
} from '../domain/my-task-service';
import { DatabaseClient } from './database-client';

interface AssignedTaskRow {
  assignment_id: string;
  assignment_status: string;
  assigned_at: Date;
  task_id: string;
  title: string;
  project_name: string;
  description: string | null;
  task_type: string;
  task_status: string;
  delivery_deadline: Date | null;
  acceptance_criteria: Record<string, unknown>;
  compensation: Record<string, unknown>;
}

interface MyApplicationRow {
  id: string;
  task_id: string;
  task_title: string;
  project_name: string;
  task_status: string;
  status: MyTaskApplicationRecord['status'];
  created_at: Date;
  updated_at: Date;
}

export class SqlMyTaskRepository implements MyTaskRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listDashboard(actorId: string): Promise<MyTaskDashboard> {
    const [assignedResult, applicationResult] = await Promise.all([
      this.db.query<AssignedTaskRow>(
        `
          SELECT
            ta.id AS assignment_id,
            ta.status AS assignment_status,
            ta.assigned_at,
            t.id AS task_id,
            t.title,
            p.name AS project_name,
            t.description,
            t.task_type,
            t.status AS task_status,
            t.delivery_deadline,
            t.acceptance_criteria,
            t.compensation
          FROM task_assignments ta
          JOIN tasks t ON t.id = ta.task_id
          JOIN projects p ON p.id = t.project_id
          WHERE ta.actor_id = $1
          ORDER BY ta.assigned_at DESC
          LIMIT 200
        `,
        [actorId]
      ),
      this.db.query<MyApplicationRow>(
        `
          SELECT
            tap.id,
            tap.task_id,
            t.title AS task_title,
            p.name AS project_name,
            t.status AS task_status,
            tap.status,
            tap.created_at,
            tap.updated_at
          FROM task_applications tap
          JOIN tasks t ON t.id = tap.task_id
          JOIN projects p ON p.id = t.project_id
          WHERE tap.applicant_actor_id = $1
          ORDER BY tap.created_at DESC
          LIMIT 200
        `,
        [actorId]
      ),
    ]);

    const assignedTasks = assignedResult.rows.map(mapAssignedTask);
    return {
      assignedTasks,
      applications: applicationResult.rows.map(mapApplication),
      summary: summarizeAssignments(assignedTasks),
    };
  }

  async findAssignedTask(actorId: string, taskId: string): Promise<MyAssignedTaskRecord | null> {
    const result = await this.db.query<AssignedTaskRow>(
      `
        SELECT
          ta.id AS assignment_id,
          ta.status AS assignment_status,
          ta.assigned_at,
          t.id AS task_id,
          t.title,
          p.name AS project_name,
          t.description,
          t.task_type,
          t.status AS task_status,
          t.delivery_deadline,
          t.acceptance_criteria,
          t.compensation
        FROM task_assignments ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE ta.actor_id = $1
          AND ta.task_id = $2
        LIMIT 1
      `,
      [actorId, taskId]
    );
    return result.rows[0] ? mapAssignedTask(result.rows[0]) : null;
  }
}

function mapAssignedTask(row: AssignedTaskRow): MyAssignedTaskRecord {
  const criteria = row.acceptance_criteria ?? {};
  const compensation = row.compensation ?? {};
  return {
    assignmentId: row.assignment_id,
    assignmentStatus: row.assignment_status,
    assignedAt: row.assigned_at.toISOString(),
    task: {
      id: row.task_id,
      title: row.title,
      project: row.project_name,
      type: row.task_type,
      deliverable: getString(criteria.deliverable, '按任务说明提交交付物'),
      deadline: row.delivery_deadline?.toISOString().slice(0, 10) ?? '待定',
      reward: getString(compensation.summary, '按任务约定结算'),
      status: toTaskStatus(row.task_status),
      description: row.description ?? '',
      acceptanceCriteria: getStringList(criteria.items),
      aiRules: getStringList(criteria.aiRules),
      qualifications: getStringList(criteria.qualifications),
    },
  };
}

function mapApplication(row: MyApplicationRow): MyTaskApplicationRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    project: row.project_name,
    taskStatus: toTaskStatus(row.task_status),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function summarizeAssignments(assignedTasks: MyAssignedTaskRecord[]): MyTaskDashboard['summary'] {
  return {
    assigned: assignedTasks.filter((item) => item.assignmentStatus === 'assigned').length,
    inProgress: assignedTasks.filter((item) => item.assignmentStatus === 'in_progress').length,
    underReview: assignedTasks.filter((item) => item.assignmentStatus === 'under_review').length,
    rework: assignedTasks.filter((item) => item.assignmentStatus === 'rework').length,
  };
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function toTaskStatus(value: string): MyAssignedTaskRecord['task']['status'] {
  if (Object.values(TaskStatus).includes(value as MyAssignedTaskRecord['task']['status'])) {
    return value as MyAssignedTaskRecord['task']['status'];
  }
  return TaskStatus.DRAFT;
}
