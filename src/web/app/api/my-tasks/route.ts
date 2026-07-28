import { NextResponse } from 'next/server';
import { AuthenticationError, requireAuthenticatedUser } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlMyTaskRepository } from '@/server/db/my-task-repository';
import { MyTaskService } from '@/server/domain/my-task-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request.headers);
    const dashboard = await new MyTaskService(
      new SqlMyTaskRepository(createDatabaseClient())
    ).listDashboard(user.actorId);
    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '任务服务尚未配置' }, { status: 503 });
    console.error('My tasks API failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '我的任务暂时不可用' }, { status: 500 });
  }
}
