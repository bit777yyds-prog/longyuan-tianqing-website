import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, requireAuthenticatedAdmin } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';

interface LockedUser {
  id: string;
  actor_id: string;
  role: string;
  status: 'active' | 'disabled' | 'invited';
}

class UserStatusConflictError extends Error {}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAuthenticatedAdmin(request.headers);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (body.status !== 'active' && body.status !== 'disabled') {
      return NextResponse.json({ error: '账号状态无效' }, { status: 400 });
    }
    if (id === admin.userId && body.status === 'disabled') {
      return NextResponse.json({ error: '不能停用当前登录账号' }, { status: 409 });
    }

    const updated = await createDatabaseClient().transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('longyuan.admin-status-guard'))");
      const activeAdmins = await tx.query<{ id: string }>(
        `
          SELECT id
          FROM app_users
          WHERE role = 'admin' AND status = 'active'
          ORDER BY id
          FOR UPDATE
        `
      );
      const targetResult = await tx.query<LockedUser>(
        'SELECT id, actor_id, role, status FROM app_users WHERE id = $1 FOR UPDATE',
        [id]
      );
      const target = targetResult.rows[0];
      if (!target) return false;
      if (target.status === body.status) return true;

      if (target.role === 'admin' && body.status === 'disabled') {
        if (activeAdmins.rows.length <= 1) {
          throw new UserStatusConflictError('At least one administrator must remain active');
        }
      }

      await tx.query('UPDATE app_users SET status = $2 WHERE id = $1', [id, body.status]);
      if (body.status === 'disabled') {
        await tx.query(
          `
            WITH revoked AS (
              UPDATE auth_sessions
              SET revoked_at = COALESCE(revoked_at, now())
              WHERE user_id = $1 AND revoked_at IS NULL
              RETURNING session_token_sha256
            )
            DELETE FROM auth_secondary_storage
            WHERE key_sha256 IN (SELECT session_token_sha256 FROM revoked)
               OR key_sha256 = $2
          `,
          [id, sha256(`active-sessions-${id}`)]
        );
      }
      await tx.query(
        `
          INSERT INTO audit_logs (
            actor_id, action, object_type, object_id, before_data, after_data
          )
          VALUES ($1, 'user.status_changed', 'app_user', $2, $3::jsonb, $4::jsonb)
        `,
        [
          admin.actorId,
          id,
          JSON.stringify({ status: target.status }),
          JSON.stringify({ status: body.status }),
        ]
      );
      return true;
    });

    if (!updated) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    return NextResponse.json({ id, status: body.status });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权修改用户' }, { status: 403 });
    if (error instanceof UserStatusConflictError) return NextResponse.json({ error: '必须保留至少一个有效管理员' }, { status: 409 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '用户服务尚未配置' }, { status: 503 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: '请求格式无效' }, { status: 400 });
    console.error('User status update failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '账号状态更新失败' }, { status: 500 });
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
