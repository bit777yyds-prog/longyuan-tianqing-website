import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, requireAuthenticatedAdmin } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlTaskApplicationRepository } from '@/server/db/task-application-repository';
import {
  TaskApplicationDecisionError,
  TaskApplicationService,
  TaskNotOpenForApplicationsError,
  type TaskApplicationDecision,
} from '@/server/domain/task-application-service';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAuthenticatedAdmin(request.headers);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const application = await new TaskApplicationService(
      new SqlTaskApplicationRepository(createDatabaseClient())
    ).decideApplication({
      actorId: admin.actorId,
      applicationId: id,
      decision: normalizeDecision(body.decision),
    });
    if (!application) return NextResponse.json({ error: '申请不存在' }, { status: 404 });
    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权处理申请' }, { status: 403 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '申请服务尚未配置' }, { status: 503 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: '请求格式无效' }, { status: 400 });
    if (error instanceof TaskNotOpenForApplicationsError) return NextResponse.json({ error: '任务当前不接受通过操作' }, { status: 409 });
    if (error instanceof TaskApplicationDecisionError) return NextResponse.json({ error: '申请状态无法处理' }, { status: 409 });
    console.error('Task application decision API failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '申请处理失败' }, { status: 500 });
  }
}

function normalizeDecision(value: unknown): TaskApplicationDecision {
  if (value === 'accepted' || value === 'rejected') return value;
  throw new TaskApplicationDecisionError('Application decision is invalid');
}
