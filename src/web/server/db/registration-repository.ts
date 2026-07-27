import {
  RegistrationRepository,
  RegistrationTransaction,
} from '../domain/registration-service';
import { Invitation } from '../domain/invitation-service';
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

export class SqlRegistrationRepository implements RegistrationRepository {
  constructor(private readonly db: TransactionalDatabaseClient) {}

  async findInvitationByTokenHash(tokenSha256: string): Promise<Invitation | null> {
    const result = await this.db.query<InvitationRow>(
      'SELECT * FROM invitations WHERE token_sha256 = $1',
      [tokenSha256]
    );
    return result.rows[0] ? mapInvitation(result.rows[0]) : null;
  }

  async transaction<T>(callback: (tx: RegistrationTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => callback(new SqlRegistrationTransaction(tx)));
  }
}

class SqlRegistrationTransaction implements RegistrationTransaction {
  constructor(private readonly db: DatabaseClient) {}

  async findInvitationByTokenHash(tokenSha256: string): Promise<Invitation | null> {
    const result = await this.db.query<InvitationRow>(
      `
        SELECT *
        FROM invitations
        WHERE token_sha256 = $1
        FOR UPDATE
      `,
      [tokenSha256]
    );
    return result.rows[0] ? mapInvitation(result.rows[0]) : null;
  }

  async createHumanActor(input: { displayName: string; email: string; role: Invitation['invitedRole'] }): Promise<{ actorId: string }> {
    const result = await this.db.query<{ id: string }>(
      `
        INSERT INTO actors (actor_type, display_name, email)
        VALUES ('human', $1, $2)
        RETURNING id
      `,
      [input.displayName, input.email]
    );
    return { actorId: result.rows[0].id };
  }

  async createUser(input: {
    actorId: string;
    displayName: string;
    email: string;
    passwordHash: string;
    role: Invitation['invitedRole'];
  }): Promise<{ userId: string }> {
    const result = await this.db.query<{ id: string }>(
      `
        INSERT INTO app_users (
          actor_id,
          name,
          email,
          email_verified,
          role,
          status
        )
        VALUES ($1, $2, $3, TRUE, $4, 'active')
        RETURNING id
      `,
      [input.actorId, input.displayName, input.email, input.role]
    );
    await this.db.query(
      `
        INSERT INTO auth_accounts (
          user_id,
          account_id,
          provider_id,
          password
        )
        VALUES ($1, $2, 'credential', $3)
      `,
      [result.rows[0].id, input.email, input.passwordHash]
    );
    return { userId: result.rows[0].id };
  }

  async markInvitationUsed(invitationId: string, actorId: string, usedAt: Date): Promise<void> {
    const result = await this.db.query<{ id: string }>(
      `
        UPDATE invitations
        SET status = 'used',
            used_by_actor_id = $2,
            used_at = $3
        WHERE id = $1
          AND status = 'active'
        RETURNING id
      `,
      [invitationId, actorId, usedAt]
    );
    if (!result.rows[0]) throw new Error('Invitation is not active');
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
