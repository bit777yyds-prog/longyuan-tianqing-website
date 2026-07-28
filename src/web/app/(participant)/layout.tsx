import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ParticipantSidebar } from '@/components/layout/participant-sidebar';
import { requireAuthenticatedUser } from '@/server/auth/authorization';

export const dynamic = 'force-dynamic';

export default async function ParticipantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await requireAuthenticatedUser(await headers());
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-participant flex-col gap-6 px-4 py-8 md:flex-row md:px-8 lg:px-16">
        <ParticipantSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
