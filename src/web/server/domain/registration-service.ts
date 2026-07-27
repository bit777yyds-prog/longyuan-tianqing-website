import { sha256Hex } from '../lib/crypto';
import { hashPassword } from '../lib/password';
import { ActorRole, Invitation } from './invitation-service';

export interface RegisteredUser {
  actorId: string;
  userId: string;
  email: string;
  role: ActorRole;
}

export interface RegisterWithInvitationInput {
  rawInvitationToken: string;
  email: string;
  displayName: string;
  password: string;
  now?: Date;
}

export interface RegistrationRepository {
  findInvitationByTokenHash(tokenSha256: string): Promise<Invitation | null>;
  transaction<T>(callback: (tx: RegistrationTransaction) => Promise<T>): Promise<T>;
}

export interface RegistrationTransaction {
  findInvitationByTokenHash(tokenSha256: string): Promise<Invitation | null>;
  createHumanActor(input: { displayName: string; email: string; role: ActorRole }): Promise<{ actorId: string }>;
  createUser(input: {
    actorId: string;
    displayName: string;
    email: string;
    passwordHash: string;
    role: ActorRole;
  }): Promise<{ userId: string }>;
  markInvitationUsed(invitationId: string, actorId: string, usedAt: Date): Promise<void>;
  writeAuditLog(input: {
    actorId: string;
    action: string;
    objectType: string;
    objectId: string;
    afterData?: Record<string, unknown>;
  }): Promise<void>;
}

export class RegistrationService {
  constructor(private readonly repository: RegistrationRepository) {}

  async registerWithInvitation(input: RegisterWithInvitationInput): Promise<RegisteredUser> {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim();
    if (!displayName) throw new Error('Display name is required');

    const now = input.now ?? new Date();
    const tokenSha256 = sha256Hex(input.rawInvitationToken);
    const preliminaryInvitation = await this.repository.findInvitationByTokenHash(tokenSha256);
    assertUsableInvitation(preliminaryInvitation, email, now);
    const passwordHash = await hashPassword(input.password);

    return this.repository.transaction(async (tx) => {
      const invitation = await tx.findInvitationByTokenHash(tokenSha256);
      assertUsableInvitation(invitation, email, now);

      const actor = await tx.createHumanActor({
        displayName,
        email,
        role: invitation.invitedRole,
      });
      const user = await tx.createUser({
        actorId: actor.actorId,
        displayName,
        email,
        passwordHash,
        role: invitation.invitedRole,
      });

      await tx.markInvitationUsed(invitation.id, actor.actorId, now);
      await tx.writeAuditLog({
        actorId: actor.actorId,
        action: 'user.registered',
        objectType: 'app_user',
        objectId: user.userId,
        afterData: {
          email,
          role: invitation.invitedRole,
          invitationId: invitation.id,
        },
      });

      return {
        actorId: actor.actorId,
        userId: user.userId,
        email,
        role: invitation.invitedRole,
      };
    });
  }
}

function assertUsableInvitation(invitation: Invitation | null, email: string, now: Date): asserts invitation is Invitation {
  if (!invitation) throw new Error('Invitation not found');
  if (invitation.status !== 'active') throw new Error('Invitation is not active');
  if (invitation.expiresAt <= now) throw new Error('Invitation has expired');
  if (invitation.invitedEmail !== email) throw new Error('Invitation email does not match');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
