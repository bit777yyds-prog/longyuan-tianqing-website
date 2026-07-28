import { NextResponse } from 'next/server';
import { AuthenticationError, requireAuthenticatedUser } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlTaskApplicationRepository } from '@/server/db/task-application-repository';
import {
  DuplicateTaskApplicationError,
  TaskApplicationService,
  TaskNotOpenForApplicationsError,
} from '@/server/domain/task-application-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request.headers);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const application = await new TaskApplicationService(
      new SqlTaskApplicationRepository(createDatabaseClient())
    ).createApplication({
      taskId: id,
      applicantUserId: user.userId,
      applicantActorId: user.actorId,
      message: typeof body.message === 'string' ? body.message : '',
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    return applicationErrorResponse(error);
  }
}

function applicationErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录后再申请任务' }, { status: 401 });
  if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '申请服务尚未配置' }, { status: 503 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: '请求格式无效' }, { status: 400 });
  if (error instanceof DuplicateTaskApplicationError) return NextResponse.json({ error: '你已经申请过这个任务' }, { status: 409 });
  if (error instanceof TaskNotOpenForApplicationsError) return NextResponse.json({ error: '任务当前不接受申请' }, { status: 409 });
  if (error instanceof Error && error.message.startsWith('Application message')) {
    return NextResponse.json({ error: '申请说明需为 10 到 2000 字' }, { status: 400 });
  }
  console.error('Task application API failed', { type: error instanceof Error ? error.name : typeof error });
  return NextResponse.json({ error: '任务申请提交失败' }, { status: 500 });
}
