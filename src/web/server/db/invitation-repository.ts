import {
  Invitation,
  InvitationRepository,
  InvitationTransaction,
} from '../domain/invitation-service';
import { DatabaseClient, TransactionalDatabaseClient } from './database-client';

interface InvitationRow {
  id: string;
  token_sha256: string;
  invited_email: string;
  invited_role: Invitation['invitedRole'];
  status: Invitation['status'];
  created_by_actor_id: string;
  created_for_actor_id: string | null;
  expires_at: Date;
  used_by_actor_id: string | null;
  used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export class SqlInvitationRepository implements InvitationRepository {
  constructor(private readonly db: TransactionalDatabaseClient) {}

  async transaction<T>(callback: (tx: InvitationTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => callback(new SqlInvitationTransaction(tx)));
  }
}

class SqlInvitationTransaction implements InvitationTransaction {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: Omit<Invitation, 'id' | 'createdAt'>): Promise<Invitation> {
    const result = await this.db.query<InvitationRow>(
      `
        INSERT INTO invitations (
          token_sha256,
          invited_email,
          invited_role,
          status,
          created_by_actor_id,
          created_for_actor_id,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        input.tokenSha256,
        input.invitedEmail,
        input.invitedRole,
        input.status,
        input.createdByActorId,
        input.createdForActorId ?? null,
        input.expiresAt,
      ]
    );
    return mapInvitation(result.rows[0]);
  }

  async findByTokenHash(tokenSha256: string): Promise<Invitation | null> {
    const result = await this.db.query<InvitationRow>(
      'SELECT * FROM invitations WHERE token_sha256 = $1 FOR UPDATE',
      [tokenSha256]
    );
    return result.rows[0] ? mapInvitation(result.rows[0]) : null;
  }

  async markUsed(invitationId: string, actorId: string, usedAt: Date): Promise<Invitation> {
    const result = await this.db.query<InvitationRow>(
      `
        UPDATE invitations
        SET status = 'used',
            used_by_actor_id = $2,
            used_at = $3
        WHERE id = $1
          AND status = 'active'
        RETURNING *
      `,
      [invitationId, actorId, usedAt]
    );
    if (!result.rows[0]) throw new Error('Invitation is not active');
    return mapInvitation(result.rows[0]);
  }

  async writeAuditLog(input: {
    actorId: string;
    action: string;
    objectType: string;
    objectId: string;
    afterData?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `
        INSERT INTO audit_logs (
          actor_id,
          action,
          object_type,
          object_id,
          after_data
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        input.actorId,
        input.action,
        input.objectType,
        input.objectId,
        JSON.stringify(input.afterData ?? null),
      ]
    );
  }
}

function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    tokenSha256: row.token_sha256,
    invitedEmail: row.invited_email,
    invitedRole: row.invited_role,
    status: row.status,
    createdByActorId: row.created_by_actor_id,
    createdForActorId: row.created_for_actor_id ?? undefined,
    expiresAt: row.expires_at,
    usedByActorId: row.used_by_actor_id ?? undefined,
    usedAt: row.used_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    createdAt: row.created_at,
  };
}
