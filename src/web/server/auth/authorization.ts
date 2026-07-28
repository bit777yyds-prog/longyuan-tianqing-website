import { getAuth } from './auth';
import { createDatabaseClient } from '../db/client';

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export interface AuthenticatedAdmin {
  userId: string;
  actorId: string;
  name: string;
  role: 'admin';
}

export interface AuthenticatedUser {
  userId: string;
  actorId: string;
  name: string;
  role: 'participant' | 'project_owner' | 'reviewer' | 'admin';
  email: string;
}

export async function requireAuthenticatedUser(headers: Headers): Promise<AuthenticatedUser> {
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user.id) throw new AuthenticationError('Authentication required');

  const result = await createDatabaseClient().query<{
    id: string;
    actor_id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  }>(
    'SELECT id, actor_id, name, email, role, status FROM app_users WHERE id = $1',
    [session.user.id]
  );
  const user = result.rows[0];
  if (!user || user.status !== 'active') throw new AuthenticationError('Active user required');

  return {
    userId: user.id,
    actorId: user.actor_id,
    name: user.name,
    role: user.role as AuthenticatedUser['role'],
    email: user.email,
  };
}

export async function requireAuthenticatedAdmin(headers: Headers): Promise<AuthenticatedAdmin> {
  const user = await requireAuthenticatedUser(headers);
  if (user.role !== 'admin') throw new AuthorizationError('Administrator role required');

  return {
    userId: user.userId,
    actorId: user.actorId,
    name: user.name,
    role: 'admin',
  };
}
