export interface CreateTaskApplicationInput {
  message: string;
}

export interface TaskApplicationRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  applicantUserId: string;
  applicantActorId: string;
  applicantName: string;
  applicantEmail: string;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'rejected';
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskApplicationRepository {
  createApplication(input: {
    taskId: string;
    applicantUserId: string;
    applicantActorId: string;
    message: string;
  }): Promise<TaskApplicationRecord>;
  listApplications(input: { taskId?: string }): Promise<TaskApplicationRecord[]>;
}

export class DuplicateTaskApplicationError extends Error {}

export class TaskNotOpenForApplicationsError extends Error {}

export class TaskApplicationService {
  constructor(private readonly repository: TaskApplicationRepository) {}

  createApplication(input: {
    taskId: string;
    applicantUserId: string;
    applicantActorId: string;
    message: string;
  }): Promise<TaskApplicationRecord> {
    return this.repository.createApplication({
      ...input,
      message: normalizeApplicationMessage(input.message),
    });
  }

  listApplications(input: { taskId?: string } = {}): Promise<TaskApplicationRecord[]> {
    return this.repository.listApplications(input);
  }
}

export function normalizeApplicationMessage(value: string): string {
  const message = value.trim();
  if (message.length < 10) throw new Error('Application message is too short');
  if (message.length > 2_000) throw new Error('Application message is too long');
  return message;
}
