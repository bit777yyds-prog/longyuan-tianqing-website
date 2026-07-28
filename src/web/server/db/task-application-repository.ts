import {
  DuplicateTaskApplicationError,
  TaskApplicationRecord,
  TaskApplicationRepository,
  TaskNotOpenForApplicationsError,
} from '../domain/task-application-service';
import { TransactionalDatabaseClient } from './database-client';

interface TaskApplicationRow {
  id: string;
  task_id: string;
  task_title: string;
  applicant_user_id: string;
  applicant_actor_id: string;
  applicant_name: string;
  applicant_email: string;
  status: TaskApplicationRecord['status'];
  message: string;
  created_at: Date;
  updated_at: Date;
}

export class SqlTaskApplicationRepository implements TaskApplicationRepository {
  constructor(private readonly db: TransactionalDatabaseClient) {}

  async createApplication(input: {
    taskId: string;
    applicantUserId: string;
    applicantActorId: string;
    message: string;
  }): Promise<TaskApplicationRecord> {
    return this.db.transaction(async (tx) => {
      const task = await tx.query<{ id: string; title: string; status: string }>(
        'SELECT id, title, status FROM tasks WHERE id = $1 FOR UPDATE',
        [input.taskId]
      );
      if (task.rows[0]?.status !== 'open') throw new TaskNotOpenForApplicationsError('Task is not open');

      const existing = await tx.query<{ id: string }>(
        'SELECT id FROM task_applications WHERE task_id = $1 AND applicant_actor_id = $2 LIMIT 1',
        [input.taskId, input.applicantActorId]
      );
      if (existing.rows[0]) throw new DuplicateTaskApplicationError('Task application already exists');

      const result = await tx.query<TaskApplicationRow>(
        `
          INSERT INTO task_applications (task_id, applicant_user_id, applicant_actor_id, message)
          VALUES ($1, $2, $3, $4)
          RETURNING
            task_applications.*,
            (SELECT title FROM tasks WHERE id = task_applications.task_id) AS task_title,
            (SELECT name FROM app_users WHERE id = task_applications.applicant_user_id) AS applicant_name,
            (SELECT email FROM app_users WHERE id = task_applications.applicant_user_id) AS applicant_email
        `,
        [input.taskId, input.applicantUserId, input.applicantActorId, input.message]
      );

      const application = mapApplication(result.rows[0]);
      await tx.query(
        `
          INSERT INTO audit_logs (actor_id, action, object_type, object_id, after_data)
          VALUES ($1, 'task.application_submitted', 'task_application', $2, $3::jsonb)
        `,
        [
          input.applicantActorId,
          application.id,
          JSON.stringify({ taskId: application.taskId, taskTitle: application.taskTitle }),
        ]
      );
      return application;
    });
  }

  async listApplications(input: { taskId?: string }): Promise<TaskApplicationRecord[]> {
    const result = await this.db.query<TaskApplicationRow>(
      `
        SELECT
          ta.*,
          t.title AS task_title,
          au.name AS applicant_name,
          au.email AS applicant_email
        FROM task_applications ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN app_users au ON au.id = ta.applicant_user_id
        WHERE ($1::uuid IS NULL OR ta.task_id = $1)
        ORDER BY ta.created_at DESC
        LIMIT 500
      `,
      [input.taskId ?? null]
    );
    return result.rows.map(mapApplication);
  }
}

function mapApplication(row: TaskApplicationRow): TaskApplicationRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    applicantUserId: row.applicant_user_id,
    applicantActorId: row.applicant_actor_id,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    status: row.status,
    message: row.message,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
