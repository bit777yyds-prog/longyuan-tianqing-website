import { describe, expect, it, vi } from 'vitest';
import {
  RegistrationRepository,
  RegistrationService,
  RegistrationTransaction,
} from './registration-service';
import { Invitation } from './invitation-service';
import { sha256Hex } from '../lib/crypto';
import { verifyPassword } from '../lib/password';

class MemoryRegistrationRepository implements RegistrationRepository {
  invitations = new Map<string, Invitation>();
  actors: Array<{ actorId: string; displayName: string; email: string; role: string }> = [];
  users: Array<{ userId: string; actorId: string; email: string; passwordHash: string; role: string }> = [];
  auditLogs: string[] = [];
  failAfterUser = false;

  async findInvitationByTokenHash(tokenSha256: string): Promise<Invitation | null> {
    return this.invitations.get(tokenSha256) ?? null;
  }

  async transaction<T>(callback: (tx: RegistrationTransaction) => Promise<T>): Promise<T> {
    const snapshot = {
      invitations: new Map(
        Array.from(this.invitations, ([key, value]) => [key, { ...value }])
      ),
      actors: [...this.actors],
      users: [...this.users],
      auditLogs: [...this.auditLogs],
    };

    try {
      return await callback(this.tx());
    } catch (error) {
      this.invitations = snapshot.invitations;
      this.actors = snapshot.actors;
      this.users = snapshot.users;
      this.auditLogs = snapshot.auditLogs;
      throw error;
    }
  }

  addInvitation(rawToken: string, overrides: Partial<Invitation> = {}) {
    const invitation: Invitation = {
      id: 'inv-1',
      tokenSha256: sha256Hex(rawToken),
      invitedEmail: 'user@example.com',
      invitedRole: 'participant',
      status: 'active',
      createdByActorId: 'actor-admin',
      expiresAt: new Date('2026-08-02T00:00:00.000Z'),
      createdAt: new Date('2026-07-26T00:00:00.000Z'),
      ...overrides,
    };
    this.invitations.set(invitation.tokenSha256, invitation);
    return invitation;
  }

  private tx(): RegistrationTransaction {
    return {
      findInvitationByTokenHash: async (tokenSha256) => this.invitations.get(tokenSha256) ?? null,
      createHumanActor: async (input) => {
        const actorId = `actor-${this.actors.length + 1}`;
        this.actors.push({ actorId, ...input });
        return { actorId };
      },
      createUser: async (input) => {
        const userId = `user-${this.users.length + 1}`;
        this.users.push({ userId, ...input });
        if (this.failAfterUser) throw new Error('write failed');
        return { userId };
      },
      markInvitationUsed: async (invitationId, actorId, usedAt) => {
        const invitation = Array.from(this.invitations.values()).find((item) => item.id === invitationId);
        if (!invitation) throw new Error('missing invitation');
        if (invitation.status !== 'active') throw new Error('Invitation is not active');
        invitation.status = 'used';
        invitation.usedByActorId = actorId;
        invitation.usedAt = usedAt;
      },
      writeAuditLog: async (input) => {
        this.auditLogs.push(input.action);
      },
    };
  }
}

describe('RegistrationService', () => {
  it('registers a human actor and app user through a valid invitation', async () => {
    const repository = new MemoryRegistrationRepository();
    repository.addInvitation('raw-token');
    const service = new RegistrationService(repository);

    const registered = await service.registerWithInvitation({
      rawInvitationToken: 'raw-token',
      email: 'USER@example.com',
      displayName: '  Long Yuan User  ',
      password: 'Longyuan2026Pass',
      now: new Date('2026-07-27T00:00:00.000Z'),
    });

    expect(registered).toEqual({
      actorId: 'actor-1',
      userId: 'user-1',
      email: 'user@example.com',
      role: 'participant',
    });
    expect(repository.actors).toEqual([
      {
        actorId: 'actor-1',
        displayName: 'Long Yuan User',
        email: 'user@example.com',
        role: 'participant',
      },
    ]);
    expect(repository.users[0].passwordHash).not.toContain('Longyuan2026Pass');
    await expect(verifyPassword('Longyuan2026Pass', repository.users[0].passwordHash)).resolves.toBe(true);
    expect(repository.invitations.get(sha256Hex('raw-token'))?.status).toBe('used');
    expect(repository.auditLogs).toEqual(['user.registered']);
  });

  it('rejects mismatched invitation email before writing actor or user rows', async () => {
    const repository = new MemoryRegistrationRepository();
    repository.addInvitation('raw-token');
    const service = new RegistrationService(repository);

    await expect(
      service.registerWithInvitation({
        rawInvitationToken: 'raw-token',
        email: 'other@example.com',
        displayName: 'Long Yuan User',
        password: 'Longyuan2026Pass',
      })
    ).rejects.toThrow('email does not match');

    expect(repository.actors).toEqual([]);
    expect(repository.users).toEqual([]);
  });

  it('rejects unknown tokens before opening a transaction', async () => {
    const repository = new MemoryRegistrationRepository();
    const service = new RegistrationService(repository);
    const transaction = vi.spyOn(repository, 'transaction');

    await expect(service.registerWithInvitation({
      rawInvitationToken: 'unknown-token',
      email: 'user@example.com',
      displayName: 'Long Yuan User',
      password: 'Longyuan2026Pass',
    })).rejects.toThrow('not found');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rolls back all writes if registration persistence fails mid-transaction', async () => {
    const repository = new MemoryRegistrationRepository();
    repository.addInvitation('raw-token');
    repository.failAfterUser = true;
    const service = new RegistrationService(repository);

    await expect(
      service.registerWithInvitation({
        rawInvitationToken: 'raw-token',
        email: 'user@example.com',
        displayName: 'Long Yuan User',
        password: 'Longyuan2026Pass',
      })
    ).rejects.toThrow('write failed');

    expect(repository.actors).toEqual([]);
    expect(repository.users).toEqual([]);
    expect(repository.invitations.get(sha256Hex('raw-token'))?.status).toBe('active');
    expect(repository.auditLogs).toEqual([]);
  });

  it('rejects expired invitations', async () => {
    const repository = new MemoryRegistrationRepository();
    repository.addInvitation('raw-token', {
      expiresAt: new Date('2026-07-26T00:00:00.000Z'),
    });
    const service = new RegistrationService(repository);

    await expect(
      service.registerWithInvitation({
        rawInvitationToken: 'raw-token',
        email: 'user@example.com',
        displayName: 'Long Yuan User',
        password: 'Longyuan2026Pass',
        now: new Date('2026-07-27T00:00:00.000Z'),
      })
    ).rejects.toThrow('expired');
  });
});
