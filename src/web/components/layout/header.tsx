'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/books', label: '书籍' },
  { href: '/tasks', label: '任务' },
  { href: '/#about', label: '关于我们' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-content items-center justify-between px-4 py-4 md:px-8 lg:px-16">
        <Link href="/" className="font-serif text-xl font-semibold text-celadon-900">
          龙渊天青
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-text hover:text-celadon-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Button asChild size="sm" variant="secondary">
            <Link href="/login">登录</Link>
          </Button>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-text md:hidden"
          aria-label="打开菜单"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-base font-medium text-text hover:text-celadon-700"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild size="sm" variant="secondary" className="mt-2 w-full">
              <Link href="/login" onClick={() => setMenuOpen(false)}>登录</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
