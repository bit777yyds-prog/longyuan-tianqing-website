import { AdminSidebar } from '@/components/layout/admin-sidebar';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-admin flex-col gap-6 px-4 py-8 md:flex-row md:px-8 lg:px-16">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
