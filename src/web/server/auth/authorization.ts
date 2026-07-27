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

export async function requireAuthenticatedAdmin(headers: Headers): Promise<AuthenticatedAdmin> {
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user.id) throw new AuthenticationError('Authentication required');

  const result = await createDatabaseClient().query<{
    id: string;
    actor_id: string;
    name: string;
    role: string;
    status: string;
  }>(
    'SELECT id, actor_id, name, role, status FROM app_users WHERE id = $1',
    [session.user.id]
  );
  const user = result.rows[0];
  if (!user || user.status !== 'active') throw new AuthenticationError('Active user required');
  if (user.role !== 'admin') throw new AuthorizationError('Administrator role required');

  return {
    userId: user.id,
    actorId: user.actor_id,
    name: user.name,
    role: 'admin',
  };
}
