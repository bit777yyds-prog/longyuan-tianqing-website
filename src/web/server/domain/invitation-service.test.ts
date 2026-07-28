import { describe, expect, it, vi } from 'vitest';
import {
  Invitation,
  InvitationRepository,
  InvitationService,
  InvitationTransaction,
} from './invitation-service';
import { sha256Hex } from '../lib/crypto';

class MemoryInvitationRepository implements InvitationRepository, InvitationTransaction {
  invitations = new Map<string, Invitation>();
  auditLogs: string[] = [];
  failAudit = false;

  async transaction<T>(callback: (tx: InvitationTransaction) => Promise<T>): Promise<T> {
    const invitations = new Map(
      Array.from(this.invitations, ([key, value]) => [key, { ...value }])
    );
    const auditLogs = [...this.auditLogs];
    try {
      return await callback(this);
    } catch (error) {
      this.invitations = invitations;
      this.auditLogs = auditLogs;
      throw error;
    }
  }

  async create(input: Omit<Invitation, 'id' | 'createdAt'>): Promise<Invitation> {
    const invitation: Invitation = {
      ...input,
      id: `inv-${this.invitations.size + 1}`,
      createdAt: new Date('2026-07-26T00:00:00.000Z'),
    };
    this.invitations.set(invitation.tokenSha256, invitation);
    return invitation;
  }

  async findByTokenHash(tokenSha256: string): Promise<Invitation | null> {
    return this.invitations.get(tokenSha256) ?? null;
  }

  async markUsed(invitationId: string, actorId: string, usedAt: Date): Promise<Invitation> {
    const invitation = Array.from(this.invitations.values()).find((item) => item.id === invitationId);
    if (!invitation) throw new Error('missing invitation');
    if (invitation.status !== 'active') throw new Error('Invitation is not active');
    invitation.status = 'used';
    invitation.usedByActorId = actorId;
    invitation.usedAt = usedAt;
    return invitation;
  }

  async writeAuditLog(input: { action: string }): Promise<void> {
    if (this.failAudit) throw new Error('audit unavailable');
    this.auditLogs.push(input.action);
  }
}

describe('InvitationService', () => {
  it('creates one-time invitations only for admins and stores token hashes', async () => {
    const repository = new MemoryInvitationRepository();
    const service = new InvitationService(repository);

    const result = await service.createInvitation(
      { actorId: 'actor-admin', role: 'admin' },
      { invitedEmail: 'User@Example.com', invitedRole: 'participant' },
      new Date('2026-07-26T00:00:00.000Z')
    );

    expect(result.rawToken).not.toEqual(result.invitation.tokenSha256);
    expect(result.invitation.tokenSha256).toEqual(sha256Hex(result.rawToken));
    expect(result.invitation.invitedEmail).toBe('user@example.com');
    expect(result.invitation.expiresAt.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(repository.auditLogs).toEqual(['invitation.created']);
  });

  it('rejects invitation creation by non-admin actors', async () => {
    const service = new InvitationService(new MemoryInvitationRepository());

    await expect(
      service.createInvitation(
        { actorId: 'actor-reviewer', role: 'reviewer' },
        { invitedEmail: 'user@example.com', invitedRole: 'participant' }
      )
    ).rejects.toThrow('Only administrators');
  });

  it('rejects invitation expiry outside the allowed window', async () => {
    const service = new InvitationService(new MemoryInvitationRepository());
    const actor = { actorId: 'actor-admin', role: 'admin' } as const;
    const now = new Date('2026-07-26T00:00:00.000Z');

    await expect(service.createInvitation(actor, {
      invitedEmail: 'user@example.com',
      invitedRole: 'participant',
      expiresAt: now,
    }, now)).rejects.toThrow('future');

    await expect(service.createInvitation(actor, {
      invitedEmail: 'user@example.com',
      invitedRole: 'participant',
      expiresAt: new Date('2026-08-26T00:00:00.000Z'),
    }, now)).rejects.toThrow('30 days');
  });

  it('accepts only active, unexpired, matching-email invitations once', async () => {
    const repository = new MemoryInvitationRepository();
    const service = new InvitationService(repository);
    const created = await service.createInvitation(
      { actorId: 'actor-admin', role: 'admin' },
      { invitedEmail: 'user@example.com', invitedRole: 'participant' },
      new Date('2026-07-26T00:00:00.000Z')
    );

    const invitation = await service.acceptInvitation({
      rawToken: created.rawToken,
      email: 'USER@example.com',
      actorId: 'actor-user',
      now: new Date('2026-07-27T00:00:00.000Z'),
    });

    expect(invitation.status).toBe('used');
    expect(invitation.usedByActorId).toBe('actor-user');
    await expect(
      service.acceptInvitation({
        rawToken: created.rawToken,
        email: 'user@example.com',
        actorId: 'actor-user-2',
        now: new Date('2026-07-27T00:00:00.000Z'),
      })
    ).rejects.toThrow('not active');
  });

  it('rejects expired invitations', async () => {
    const repository = new MemoryInvitationRepository();
    const service = new InvitationService(repository);
    const created = await service.createInvitation(
      { actorId: 'actor-admin', role: 'admin' },
      { invitedEmail: 'user@example.com', invitedRole: 'participant' },
      new Date('2026-07-26T00:00:00.000Z')
    );

    await expect(
      service.acceptInvitation({
        rawToken: created.rawToken,
        email: 'user@example.com',
        actorId: 'actor-user',
        now: new Date('2026-08-03T00:00:00.000Z'),
      })
    ).rejects.toThrow('expired');
  });
});

describe('InvitationService audit behavior', () => {
  it('does not write audit logs if persistence fails', async () => {
    const repository: InvitationRepository = {
      transaction: vi.fn(async (callback) => callback({
        create: vi.fn(async () => {
          throw new Error('db unavailable');
        }),
        findByTokenHash: vi.fn(),
        markUsed: vi.fn(),
        writeAuditLog: vi.fn(),
      })),
    };
    const service = new InvitationService(repository);

    await expect(
      service.createInvitation(
        { actorId: 'actor-admin', role: 'admin' },
        { invitedEmail: 'user@example.com', invitedRole: 'participant' }
      )
    ).rejects.toThrow('db unavailable');
  });

  it('rolls back invitation creation if its audit log fails', async () => {
    const repository = new MemoryInvitationRepository();
    repository.failAudit = true;
    const service = new InvitationService(repository);

    await expect(service.createInvitation(
      { actorId: 'actor-admin', role: 'admin' },
      { invitedEmail: 'user@example.com', invitedRole: 'participant' }
    )).rejects.toThrow('audit unavailable');

    expect(repository.invitations.size).toBe(0);
    expect(repository.auditLogs).toEqual([]);
  });
});
