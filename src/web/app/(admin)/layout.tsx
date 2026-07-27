import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminHeader } from '@/components/layout/admin-header';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { requireAuthenticatedAdmin } from '@/server/auth/authorization';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let admin;
  try {
    admin = await requireAuthenticatedAdmin(await headers());
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-bg">
      <AdminHeader name={admin.name} role={admin.role} />
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
