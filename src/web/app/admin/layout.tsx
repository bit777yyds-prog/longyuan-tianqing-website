import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminHeader } from '@/components/layout/admin-header';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { getAuth } from '@/server/auth/auth';
import { createDatabaseClient } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let session: Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>> | null;
  let identity: { name: string; role: string } | undefined;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
    if (session?.user.id) {
      const result = await createDatabaseClient().query<{ name: string; role: string; status: string }>(
        'SELECT name, role, status FROM app_users WHERE id = $1',
        [session.user.id]
      );
      const currentUser = result.rows[0];
      if (currentUser?.status === 'active' && currentUser.role === 'admin') {
        identity = { name: currentUser.name, role: currentUser.role };
      }
    }
  } catch {
    redirect('/login');
  }

  if (!session?.user) redirect('/login');
  if (!identity) redirect('/');

  return (
    <div className="min-h-screen bg-bg">
      <AdminHeader name={identity.name} role={identity.role} />
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
