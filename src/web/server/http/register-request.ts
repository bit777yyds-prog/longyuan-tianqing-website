import { RegisterWithInvitationInput } from '../domain/registration-service';

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

export function parseRegisterRequest(body: unknown): RegisterWithInvitationInput {
  if (!isRecord(body)) throw new InvalidRequestError('Request body must be a JSON object');

  return {
    rawInvitationToken: requireString(body.token, 'token', 512),
    email: requireString(body.email, 'email', 320),
    displayName: requireString(body.displayName, 'displayName', 100),
    password: requireString(body.password, 'password', 128),
  };
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidRequestError(`${field} is required`);
  }
  if (value.length > maxLength) throw new InvalidRequestError(`${field} is too long`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
