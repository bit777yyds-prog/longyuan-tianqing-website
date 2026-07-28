import { NextResponse } from 'next/server';
import { TaskStatus } from '@longyuan/shared';
import { AuthenticationError, AuthorizationError, requireAuthenticatedAdmin } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlTaskRepository } from '@/server/db/task-repository';
import { TaskService } from '@/server/domain/task-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url);
    const includeDrafts = url.searchParams.get('scope') === 'admin';
    if (includeDrafts) await requireAuthenticatedAdmin(request.headers);
    const { id } = await context.params;
    const task = await new TaskService(new SqlTaskRepository(createDatabaseClient())).findTask(id, { includeDrafts });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (error) {
    return taskDetailErrorResponse(error, '任务详情暂时不可用');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAuthenticatedAdmin(request.headers);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const service = new TaskService(new SqlTaskRepository(createDatabaseClient()));
    if (body.status === undefined) {
      const task = await service.updateDraftTask(admin.actorId, id, {
        title: getString(body.title),
        projectName: getString(body.projectName),
        description: getString(body.description),
        taskType: getString(body.taskType),
        deliverable: getString(body.deliverable),
        deliveryDeadline: getOptionalString(body.deliveryDeadline),
        reward: getOptionalString(body.reward),
        slotsTotal: getOptionalNumber(body.slotsTotal),
        acceptanceCriteria: getStringList(body.acceptanceCriteria),
        aiRules: getStringList(body.aiRules),
        qualifications: getStringList(body.qualifications),
      });
      if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
      return NextResponse.json({ task });
    }
    const task = await service.updateTaskStatus(admin.actorId, id, normalizeStatus(body.status));
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (error) {
    return taskDetailErrorResponse(error, '任务状态更新失败');
  }
}

function normalizeStatus(value: unknown): TaskStatus {
  if (value === TaskStatus.DRAFT || value === TaskStatus.OPEN || value === TaskStatus.CLOSED) return value;
  throw new Error('Task status transition is not supported');
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return undefined;
}

function getStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return value.split('\n');
  return [];
}

function taskDetailErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权操作任务' }, { status: 403 });
  if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '任务服务尚未配置' }, { status: 503 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: '请求格式无效' }, { status: 400 });
  if (error instanceof Error && error.message === 'Task status transition is not supported') {
    return NextResponse.json({ error: '任务状态流转不被允许' }, { status: 400 });
  }
  if (error instanceof Error && isClientTaskError(error.message)) {
    return NextResponse.json({ error: '任务信息不完整或格式错误' }, { status: 400 });
  }
  console.error('Task detail API failed', { type: error instanceof Error ? error.name : typeof error });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function isClientTaskError(message: string): boolean {
  return [
    'Task title',
    'Project name',
    'Task description',
    'Task type',
    'Deliverable',
    'Acceptance criteria',
    'AI rules',
    'Qualifications',
    'Delivery deadline',
    'Slots total',
    'Text field',
    'Only draft tasks',
  ].some((prefix) => message.startsWith(prefix));
}
