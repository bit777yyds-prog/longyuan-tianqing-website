'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/my-tasks', label: '我的任务' },
  { href: '/my-tasks', label: '我的申请' },
  { href: '/my-tasks', label: '消息' },
  { href: '/my-tasks', label: '个人资料' },
];

export function ParticipantSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <aside className="shrink-0">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-border bg-surface p-3 text-sm font-medium text-text md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        参与者中心
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <nav
        className={cn(
          'mt-2 flex-col gap-1 rounded-lg border border-border bg-surface p-2 md:mt-0 md:flex md:w-56',
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
