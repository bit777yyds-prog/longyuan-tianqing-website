import { generateToken, sha256Hex } from '../lib/crypto';

export type ActorRole = 'participant' | 'project_owner' | 'reviewer' | 'admin';
export type InvitationStatus = 'active' | 'used' | 'revoked' | 'expired';

export interface Invitation {
  id: string;
  tokenSha256: string;
  invitedEmail: string;
  invitedRole: ActorRole;
  status: InvitationStatus;
  createdByActorId: string;
  createdForActorId?: string;
  expiresAt: Date;
  usedByActorId?: string;
  usedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface ActorContext {
  actorId: string;
  role: ActorRole;
}

export interface CreateInvitationInput {
  invitedEmail: string;
  invitedRole: ActorRole;
  expiresAt?: Date;
}

export interface AcceptInvitationInput {
  rawToken: string;
  email: string;
  actorId: string;
  now?: Date;
}

export interface InvitationRepository {
  transaction<T>(callback: (tx: InvitationTransaction) => Promise<T>): Promise<T>;
}

export interface InvitationTransaction {
  create(input: Omit<Invitation, 'id' | 'createdAt'>): Promise<Invitation>;
  findByTokenHash(tokenSha256: string): Promise<Invitation | null>;
  markUsed(invitationId: string, actorId: string, usedAt: Date): Promise<Invitation>;
  writeAuditLog(input: {
    actorId: string;
    action: string;
    objectType: string;
    objectId: string;
    afterData?: Record<string, unknown>;
  }): Promise<void>;
}

export interface CreatedInvitation {
  invitation: Invitation;
  rawToken: string;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class InvitationService {
  constructor(private readonly repository: InvitationRepository) {}

  async createInvitation(actor: ActorContext, input: CreateInvitationInput, now = new Date()): Promise<CreatedInvitation> {
    requireAdmin(actor);
    assertEmail(input.invitedEmail);
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_TTL_MS);
    assertInvitationExpiry(expiresAt, now);
    const rawToken = generateToken(32);
    const invitation = await this.repository.transaction(async (tx) => {
      const created = await tx.create({
        tokenSha256: sha256Hex(rawToken),
        invitedEmail: normalizeEmail(input.invitedEmail),
        invitedRole: input.invitedRole,
        status: 'active',
        createdByActorId: actor.actorId,
        expiresAt,
      });

      await tx.writeAuditLog({
        actorId: actor.actorId,
        action: 'invitation.created',
        objectType: 'invitation',
        objectId: created.id,
        afterData: {
          invitedEmail: created.invitedEmail,
          invitedRole: created.invitedRole,
          expiresAt: created.expiresAt.toISOString(),
        },
      });
      return created;
    });

    return { invitation, rawToken };
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<Invitation> {
    assertEmail(input.email);
    const now = input.now ?? new Date();
    return this.repository.transaction(async (tx) => {
      const invitation = await tx.findByTokenHash(sha256Hex(input.rawToken));

      if (!invitation) throw new Error('Invitation not found');
      if (invitation.status !== 'active') throw new Error('Invitation is not active');
      if (invitation.expiresAt <= now) throw new Error('Invitation has expired');
      if (invitation.invitedEmail !== normalizeEmail(input.email)) {
        throw new Error('Invitation email does not match');
      }

      const usedInvitation = await tx.markUsed(invitation.id, input.actorId, now);
      await tx.writeAuditLog({
        actorId: input.actorId,
        action: 'invitation.used',
        objectType: 'invitation',
        objectId: invitation.id,
      });
      return usedInvitation;
    });
  }
}

function requireAdmin(actor: ActorContext): void {
  if (actor.role !== 'admin') {
    throw new Error('Only administrators can create invitations');
  }
}

function assertEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error('Invalid email address');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertInvitationExpiry(expiresAt: Date, now: Date): void {
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new Error('Invitation expiry must be in the future');
  }
  if (expiresAt.getTime() > now.getTime() + MAX_TTL_MS) {
    throw new Error('Invitation expiry cannot exceed 30 days');
  }
}
