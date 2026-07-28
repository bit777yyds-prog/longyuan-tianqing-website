import { NextResponse } from 'next/server';
import { requireAuthenticatedAdmin, AuthenticationError, AuthorizationError } from '@/server/auth/authorization';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlInvitationRepository } from '@/server/db/invitation-repository';
import { ActorRole, InvitationService } from '@/server/domain/invitation-service';

const roles = new Set<ActorRole>(['participant', 'project_owner', 'reviewer', 'admin']);

interface InvitationListRow {
  id: string;
  invited_email: string;
  invited_role: ActorRole;
  status: 'active' | 'used' | 'revoked' | 'expired';
  created_by: string;
  created_at: Date;
  expires_at: Date;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuthenticatedAdmin(request.headers);
    const result = await createDatabaseClient().query<InvitationListRow>(
      `
        SELECT
          i.id,
          i.invited_email,
          i.invited_role,
          CASE
            WHEN i.status = 'active' AND i.expires_at <= now() THEN 'expired'
            ELSE i.status
          END AS status,
          COALESCE(a.display_name, '管理员') AS created_by,
          i.created_at,
          i.expires_at
        FROM invitations i
        LEFT JOIN actors a ON a.id = i.created_by_actor_id
        ORDER BY i.created_at DESC
        LIMIT 500
      `
    );
    return NextResponse.json({ invitations: result.rows.map(toResponseRow) });
  } catch (error) {
    return invitationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAuthenticatedAdmin(request.headers);
    const body = await request.json() as Record<string, unknown>;
    const invitedEmail = typeof body.email === 'string' ? body.email : '';
    const invitedRole = typeof body.role === 'string' && roles.has(body.role as ActorRole)
      ? body.role as ActorRole
      : undefined;
    const expiresAt = typeof body.expiresAt === 'string' ? new Date(body.expiresAt) : undefined;
    if (!invitedRole) return NextResponse.json({ error: '邀请角色无效' }, { status: 400 });

    const service = new InvitationService(new SqlInvitationRepository(createDatabaseClient()));
    const created = await service.createInvitation(admin, { invitedEmail, invitedRole, expiresAt });
    return NextResponse.json({
      invitation: {
        id: created.invitation.id,
        invitedEmail: created.invitation.invitedEmail,
        invitedRole: created.invitation.invitedRole,
        status: created.invitation.status,
        createdBy: admin.name,
        createdAt: created.invitation.createdAt.toISOString(),
        expiresAt: created.invitation.expiresAt.toISOString(),
      },
      rawToken: created.rawToken,
    }, { status: 201 });
  } catch (error) {
    return invitationErrorResponse(error);
  }
}

function toResponseRow(row: InvitationListRow) {
  return {
    id: row.id,
    invitedEmail: row.invited_email,
    invitedRole: row.invited_role,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  };
}

function invitationErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (error instanceof AuthorizationError) return NextResponse.json({ error: '无权执行该操作' }, { status: 403 });
  if (error instanceof DatabaseConfigurationError) return NextResponse.json({ error: '邀请服务尚未配置' }, { status: 503 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: '请求格式无效' }, { status: 400 });
  if (error instanceof Error && (
    error.message.startsWith('Invalid email') || error.message.startsWith('Invitation expiry')
  )) {
    return NextResponse.json({ error: '邮箱或有效期无效，有效期不得超过 30 天' }, { status: 400 });
  }
  console.error('Invitation API failed', { type: error instanceof Error ? error.name : typeof error });
  return NextResponse.json({ error: '邀请服务暂时不可用' }, { status: 500 });
}
