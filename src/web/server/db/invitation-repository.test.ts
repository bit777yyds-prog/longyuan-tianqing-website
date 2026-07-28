import { describe, expect, it } from 'vitest';
import { SqlInvitationRepository } from './invitation-repository';
import { TransactionalDatabaseClient } from './database-client';

class RecordingClient implements TransactionalDatabaseClient {
  calls: Array<{ sql: string; params?: unknown[] }> = [];
  returnEmptyUpdate = false;

  async transaction<T>(callback: (tx: TransactionalDatabaseClient) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async query<Row>(sql: string, params?: unknown[]) {
    this.calls.push({ sql, params });
    if (this.returnEmptyUpdate && sql.includes('UPDATE invitations')) return { rows: [] };
    return {
      rows: [
        {
          id: 'inv-1',
          token_sha256: 'hash',
          invited_email: 'user@example.com',
          invited_role: 'participant',
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
}

describe('SqlInvitationRepository', () => {
  it('stores token hashes and maps invitation rows', async () => {
    const client = new RecordingClient();
    const repository = new SqlInvitationRepository(client);

    const invitation = await repository.transaction((tx) => tx.create({
      tokenSha256: 'hash',
      invitedEmail: 'user@example.com',
      invitedRole: 'participant',
      status: 'active',
      createdByActorId: 'actor-admin',
      expiresAt: new Date('2026-08-02T00:00:00.000Z'),
    }));

    expect(client.calls[0].sql).toContain('INSERT INTO invitations');
    expect(client.calls[0].params).toEqual([
      'hash',
      'user@example.com',
      'participant',
      'active',
      'actor-admin',
      null,
      new Date('2026-08-02T00:00:00.000Z'),
    ]);
    expect(invitation).toMatchObject({
      id: 'inv-1',
      tokenSha256: 'hash',
      invitedEmail: 'user@example.com',
    });
  });

  it('marks invitations used without accepting non-active rows', async () => {
    const client = new RecordingClient();
    const repository = new SqlInvitationRepository(client);

    await repository.transaction((tx) => tx.markUsed(
      'inv-1',
      'actor-user',
      new Date('2026-07-27T00:00:00.000Z')
    ));

    expect(client.calls[0].sql).toContain("AND status = 'active'");
    expect(client.calls[0].sql).toContain('RETURNING *');
    expect(client.calls[0].params).toEqual([
      'inv-1',
      'actor-user',
      new Date('2026-07-27T00:00:00.000Z'),
    ]);
  });

  it('rejects a second attempt when no active invitation is updated', async () => {
    const client = new RecordingClient();
    client.returnEmptyUpdate = true;
    const repository = new SqlInvitationRepository(client);

    await expect(repository.transaction((tx) => tx.markUsed(
      'inv-1',
      'actor-user',
      new Date('2026-07-27T00:00:00.000Z')
    ))).rejects.toThrow('not active');
  });
});
