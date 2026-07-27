import { describe, expect, it } from 'vitest';
import { QueryResult, TransactionalDatabaseClient } from './database-client';
import { SqlRegistrationRepository } from './registration-repository';

class RecordingTransactionalClient implements TransactionalDatabaseClient {
  calls: Array<{ sql: string; params?: unknown[] }> = [];

  async transaction<T>(callback: (tx: TransactionalDatabaseClient) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, params });
    const normalized = sql.replace(/\s+/gu, ' ');
    if (normalized.includes('FROM invitations')) {
      return {
        rows: [
          {
            id: 'inv-1',
            token_sha256: 'hash',
            invited_email: 'user@example.com',
            invited_role: 'reviewer',
            status: 'active',
            created_by_actor_id: 'actor-admin',
            created_for_actor_id: null,
            expires_at: new Date('2026-08-02T00:00:00.000Z'),
            used_by_actor_id: null,
            used_at: null,
            revoked_at: null,
            created_at: new Date('2026-07-26T00:00:00.000Z'),
          } as Row,
        ],
      };
    }
    if (normalized.includes('INSERT INTO actors')) {
      return { rows: [{ id: 'actor-user' } as Row] };
    }
    if (normalized.includes('INSERT INTO app_users')) {
      return { rows: [{ id: 'user-1' } as Row] };
    }
    if (normalized.includes('UPDATE invitations')) {
      return { rows: [{ id: 'inv-1' } as Row] };
    }
    return { rows: [] };
  }
}

describe('SqlRegistrationRepository', () => {
  it('wraps registration operations in a database transaction', async () => {
    const client = new RecordingTransactionalClient();
    const repository = new SqlRegistrationRepository(client);

    await repository.transaction(async (tx) => {
      const invitation = await tx.findInvitationByTokenHash('hash');
      const actor = await tx.createHumanActor({
        displayName: 'Long Yuan User',
        email: 'user@example.com',
        role: 'reviewer',
      });
      const user = await tx.createUser({
        actorId: actor.actorId,
        displayName: 'Long Yuan User',
        email: 'user@example.com',
        passwordHash: 'scrypt$hash',
        role: invitation?.invitedRole ?? 'reviewer',
      });
      await tx.markInvitationUsed(invitation?.id ?? 'inv-1', actor.actorId, new Date('2026-07-27T00:00:00.000Z'));
      await tx.writeAuditLog({
        actorId: actor.actorId,
        action: 'user.registered',
        objectType: 'app_user',
        objectId: user.userId,
      });
    });

    expect(client.calls.map((call) => call.sql)).toEqual([
      expect.stringContaining('FOR UPDATE'),
      expect.stringContaining('INSERT INTO actors'),
      expect.stringContaining('INSERT INTO app_users'),
      expect.stringContaining('INSERT INTO auth_accounts'),
      expect.stringContaining("AND status = 'active'"),
      expect.stringContaining('INSERT INTO audit_logs'),
    ]);
    expect(client.calls[4].sql).toContain('RETURNING id');
  });
});
