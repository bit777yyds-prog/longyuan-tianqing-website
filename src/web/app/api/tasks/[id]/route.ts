import { NextResponse } from 'next/server';
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
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权查看任务' }, { status: 403 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '任务服务尚未配置' }, { status: 503 });
    console.error('Task detail API failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '任务详情暂时不可用' }, { status: 500 });
  }
}
