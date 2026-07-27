import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, requireAuthenticatedAdmin } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAuthenticatedAdmin(request.headers);
    const { id } = await context.params;
    const revoked = await createDatabaseClient().transaction(async (tx) => {
      const result = await tx.query<{ id: string }>(
        `
          UPDATE invitations
          SET status = 'revoked', revoked_at = now()
          WHERE id = $1
            AND status = 'active'
            AND expires_at > now()
          RETURNING id
        `,
        [id]
      );
      if (!result.rows[0]) return false;
      await tx.query(
        `
          INSERT INTO audit_logs (actor_id, action, object_type, object_id, after_data)
          VALUES ($1, 'invitation.revoked', 'invitation', $2, $3::jsonb)
        `,
        [admin.actorId, id, JSON.stringify({ status: 'revoked' })]
      );
      return true;
    });
    if (!revoked) return NextResponse.json({ error: '邀请不存在或已不可撤销' }, { status: 409 });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权执行该操作' }, { status: 403 });
    if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '邀请服务尚未配置' }, { status: 503 });
    console.error('Invitation revoke failed', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ error: '撤销邀请失败' }, { status: 500 });
  }
}
