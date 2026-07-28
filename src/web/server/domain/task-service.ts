import { TaskStatus, type TaskStatus as SharedTaskStatus } from '@longyuan/shared';

export type TaskInputStatus = typeof TaskStatus.DRAFT | typeof TaskStatus.OPEN;

export interface CreateTaskInput {
  title: string;
  projectName: string;
  description: string;
  taskType: string;
  deliverable: string;
  deliveryDeadline?: string;
  reward?: string;
  slotsTotal?: number;
  status: TaskInputStatus;
  acceptanceCriteria: string[];
  aiRules: string[];
  qualifications: string[];
}

export interface TaskRecord {
  id: string;
  title: string;
  project: string;
  type: string;
  deliverable: string;
  deadline: string;
  reward: string;
  status: SharedTaskStatus;
  slotsRemaining: number;
  description: string;
  acceptanceCriteria: string[];
  aiRules: string[];
  qualifications: string[];
  faq: { q: string; a: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskRepository {
  createTask(actorId: string, input: NormalizedCreateTaskInput): Promise<TaskRecord>;
  listTasks(input: { includeDrafts: boolean }): Promise<TaskRecord[]>;
  findTask(id: string, input: { includeDrafts: boolean }): Promise<TaskRecord | null>;
}

export interface NormalizedCreateTaskInput extends CreateTaskInput {
  slotsTotal: number;
  reward: string;
}

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  createTask(actorId: string, input: CreateTaskInput): Promise<TaskRecord> {
    const normalized = normalizeCreateTaskInput(input);
    return this.repository.createTask(actorId, normalized);
  }

  listTasks(input: { includeDrafts: boolean }): Promise<TaskRecord[]> {
    return this.repository.listTasks(input);
  }

  findTask(id: string, input: { includeDrafts: boolean }): Promise<TaskRecord | null> {
    return this.repository.findTask(id, input);
  }
}

export function normalizeCreateTaskInput(input: CreateTaskInput): NormalizedCreateTaskInput {
  const title = requireText(input.title, 'Task title', 120);
  const projectName = requireText(input.projectName, 'Project name', 120);
  const description = requireText(input.description, 'Task description', 4_000);
  const taskType = requireText(input.taskType, 'Task type', 80);
  const deliverable = requireText(input.deliverable, 'Deliverable', 240);
  const reward = optionalText(input.reward, 240) ?? '按任务约定结算';
  const slotsTotal = normalizeSlots(input.slotsTotal);
  const acceptanceCriteria = normalizeTextList(input.acceptanceCriteria, 'Acceptance criteria');
  const aiRules = normalizeTextList(input.aiRules, 'AI rules');
  const qualifications = normalizeTextList(input.qualifications, 'Qualifications');

  if (input.status !== TaskStatus.DRAFT && input.status !== TaskStatus.OPEN) {
    throw new Error('Task status must be draft or open');
  }
  if (input.deliveryDeadline && Number.isNaN(new Date(input.deliveryDeadline).getTime())) {
    throw new Error('Delivery deadline is invalid');
  }

  return {
    title,
    projectName,
    description,
    taskType,
    deliverable,
    deliveryDeadline: input.deliveryDeadline,
    reward,
    slotsTotal,
    status: input.status,
    acceptanceCriteria,
    aiRules,
    qualifications,
  };
}

function requireText(value: string, field: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > maxLength) throw new Error(`${field} is too long`);
  return trimmed;
}

function optionalText(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) throw new Error('Text field is too long');
  return trimmed;
}

function normalizeTextList(value: string[], field: string): string[] {
  const items = value.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) throw new Error(`${field} must include at least one item`);
  if (items.some((item) => item.length > 500)) throw new Error(`${field} item is too long`);
  return items.slice(0, 20);
}

function normalizeSlots(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new Error('Slots total must be an integer between 1 and 999');
  }
  return value;
}
