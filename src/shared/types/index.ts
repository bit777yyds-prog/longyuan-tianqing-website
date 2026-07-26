export const EventType = {
  TASK_CREATED: 'task.created',
  DELIVERABLE_SUBMITTED: 'deliverable.submitted',
  REVIEW_RECOMMENDED: 'review.recommended',
  REVIEW_PASSED: 'review.passed',
  REVIEW_REWORK: 'review.rework',
  REVIEW_REJECTED: 'review.rejected',
  AGENT_RUN_FAILED: 'agent.run.failed',
  AGENT_EGRESS_BLOCKED: 'agent.egress_blocked',
  COST_LIMIT_EXCEEDED: 'agent.cost_limit_exceeded',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const TaskStatus = {
  DRAFT: 'draft',
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  UNDER_REVIEW: 'under_review',
  REWORK: 'rework',
  ACCEPTED: 'accepted',
  CLOSED: 'closed',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const CandidateStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MODIFIED: 'modified',
  APPLIED: 'applied',
} as const;

export type CandidateStatus = (typeof CandidateStatus)[keyof typeof CandidateStatus];

export const RunMode = {
  PRIMARY: 'primary',
  SHADOW: 'shadow',
  REPLAY: 'replay',
  RERUN: 'rerun',
} as const;

export type RunMode = (typeof RunMode)[keyof typeof RunMode];

export const EgressClass = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  RESTRICTED: 'restricted',
  FORBIDDEN: 'forbidden',
} as const;

export type EgressClass = (typeof EgressClass)[keyof typeof EgressClass];

export const AutonomyLevel = {
  A0: 'A0',
  A1: 'A1',
  A2: 'A2',
  A3: 'A3',
} as const;

export type AutonomyLevel = (typeof AutonomyLevel)[keyof typeof AutonomyLevel];

export interface Book {
  id: string;
  title: string;
  series: string;
  coverUrl: string;
  tagline: string;
  status: 'published' | 'upcoming' | 'in_progress';
  author?: string;
  year?: number;
  description?: string;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  type: string;
  deliverable: string;
  deadline: string;
  reward: string;
  status: TaskStatus;
  slotsRemaining: number;
  description: string;
  acceptanceCriteria: string[];
  aiRules: string[];
  qualifications: string[];
  faq: { q: string; a: string }[];
}

export interface CandidateEvent {
  id: string;
  agentName: string;
  agentVersion: string;
  modelName: string;
  promptVersion: string;
  proposedEventType: EventType;
  status: CandidateStatus;
  containsExternalContent: boolean;
  schemaValid: boolean;
  languageValid: boolean;
  egressClass: EgressClass;
  confidence: number;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  jobType: string;
  runMode: RunMode;
  modelName: string;
  promptVersion: string;
  inputRef: string;
  egressManifest: string;
  tokensUsed: number;
  costUsd: number;
  outputSha256: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  failureReason?: string;
  startedAt: string;
  finishedAt?: string;
}
