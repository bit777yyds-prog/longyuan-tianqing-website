import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, requireAuthenticatedAdmin } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlTaskApplicationRepository } from '@/server/db/task-application-repository';
import { TaskApplicationService } from '@/server/domain/task-application-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuthenticatedAdmin(request.headers);
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId') ?? undefined;
    const applications = await new TaskApplicationService(
      new SqlTaskApplicationRepository(createDatabaseClient())
    ).listApplications({ taskId });
    return NextResponse.json({ applications });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权查看申请' }, { status: 403 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '申请服务尚未配置' }, { status: 503 });
    console.error('Task applications list API failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '申请列表暂时不可用' }, { status: 500 });
  }
}
