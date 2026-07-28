import Link from 'next/link';
import { Bell, ExternalLink } from 'lucide-react';
import { AdminAccount } from './admin-account';

interface AdminHeaderProps {
  name: string;
  role: string;
}

export function AdminHeader({ name, role }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin" className="shrink-0 font-serif text-lg font-semibold text-celadon-900">
            龙渊天青
          </Link>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
          <span className="hidden text-sm text-text-muted sm:block">管理后台</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-text-muted hover:bg-bg hover:text-text sm:flex"
          >
            查看前台
            <ExternalLink size={15} aria-hidden="true" />
          </Link>
          <button type="button" className="rounded-sm p-2 text-text-muted hover:bg-bg hover:text-text" aria-label="通知">
            <Bell size={18} />
          </button>
          <AdminAccount name={name} role={role} />
        </div>
      </div>
    </header>
  );
}
