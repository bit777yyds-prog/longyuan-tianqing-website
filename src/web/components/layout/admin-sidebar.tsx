'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: '概览' },
  { href: '/', label: '项目' },
  { href: '/', label: '作品' },
  { href: '/tasks', label: '任务' },
  { href: '/', label: '申请' },
  { href: '/', label: '交付物' },
  { href: '/', label: '验收' },
  { href: '/', label: '候选事件' },
  { href: '/', label: 'Agent运行' },
  { href: '/', label: '事件总账' },
  { href: '/', label: '冲突与裁决' },
  { href: '/', label: '参与者' },
  { href: '/', label: '系统设置' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <aside className="shrink-0">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-border bg-surface p-3 text-sm font-medium text-text lg:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        管理后台
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <nav
        className={cn(
          'mt-2 flex-col gap-1 rounded-lg border border-border bg-surface p-2 lg:mt-0 lg:flex lg:w-56',
          open ? 'flex' : 'hidden'
        )}
      >
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(link.href)
                ? 'bg-celadon-100 text-celadon-900'
                : 'text-text hover:bg-bg'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
