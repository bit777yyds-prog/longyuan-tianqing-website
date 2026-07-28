'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, LayoutDashboard, MailPlus, ScrollText, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin', label: '工作台', icon: LayoutDashboard },
  { href: '/admin/tasks', label: '任务管理', icon: ClipboardList },
  { href: '/admin/invitations', label: '邀请管理', icon: MailPlus },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/audit', label: '审计日志', icon: ScrollText, disabled: true },
  { href: '/admin/settings', label: '系统设置', icon: Settings, disabled: true },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <aside className="shrink-0 lg:w-60">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-border bg-surface p-3 text-sm font-medium text-text lg:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        后台导航
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <nav
        className={cn(
          'mt-2 flex-col gap-1 border-r border-border bg-surface p-3 lg:mt-0 lg:flex lg:min-h-[calc(100vh-65px)]',
          open ? 'flex' : 'hidden'
        )}
      >
        {links.map((link) => {
          const Icon = link.icon;
          if (link.disabled) {
            return (
              <span key={link.label} className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-text-muted opacity-60">
                <Icon size={17} aria-hidden="true" />
                {link.label}
              </span>
            );
          }
          return (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors',
                isActivePath(pathname, link.href)
                  ? 'bg-celadon-100 text-celadon-900'
                  : 'text-text hover:bg-bg'
              )}
              onClick={() => setOpen(false)}
            >
              <Icon size={17} aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
