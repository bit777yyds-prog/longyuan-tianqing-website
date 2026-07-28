import type { TaskStatus as SharedTaskStatus } from '@longyuan/shared';

export interface MyAssignedTaskRecord {
  assignmentId: string;
  assignmentStatus: 'assigned' | 'in_progress' | 'under_review' | 'rework' | 'accepted' | 'completed' | string;
  assignedAt: string;
  task: {
    id: string;
    title: string;
    project: string;
    type: string;
    deliverable: string;
    deadline: string;
    reward: string;
    status: SharedTaskStatus;
    description: string;
    acceptanceCriteria: string[];
    aiRules: string[];
    qualifications: string[];
  };
}

export interface MyTaskApplicationRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  project: string;
  taskStatus: SharedTaskStatus;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface MyTaskDashboard {
  assignedTasks: MyAssignedTaskRecord[];
  applications: MyTaskApplicationRecord[];
  summary: {
    assigned: number;
    inProgress: number;
    underReview: number;
    rework: number;
  };
}

export interface MyTaskRepository {
  listDashboard(actorId: string): Promise<MyTaskDashboard>;
  findAssignedTask(actorId: string, taskId: string): Promise<MyAssignedTaskRecord | null>;
}

export class MyTaskService {
  constructor(private readonly repository: MyTaskRepository) {}

  listDashboard(actorId: string): Promise<MyTaskDashboard> {
    return this.repository.listDashboard(actorId);
  }

  findAssignedTask(actorId: string, taskId: string): Promise<MyAssignedTaskRecord | null> {
    return this.repository.findAssignedTask(actorId, taskId);
  }
}
