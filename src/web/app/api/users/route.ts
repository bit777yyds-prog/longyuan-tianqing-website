import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, requireAuthenticatedAdmin } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';

interface UserListRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'project_owner' | 'reviewer' | 'participant';
  status: 'active' | 'disabled' | 'invited';
  last_seen_at: Date | null;
  created_at: Date;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuthenticatedAdmin(request.headers);
    const result = await createDatabaseClient().query<UserListRow>(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.status,
          MAX(COALESCE(s.last_seen_at, s.created_at)) AS last_seen_at,
          u.created_at
        FROM app_users u
        LEFT JOIN auth_sessions s ON s.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 500
      `
    );
    return NextResponse.json({
      users: result.rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastSeenAt: user.last_seen_at?.toISOString() ?? null,
        joinedAt: user.created_at.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权查看用户' }, { status: 403 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '用户服务尚未配置' }, { status: 503 });
    console.error('User list failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '用户列表暂时不可用' }, { status: 500 });
  }
}
