'use client';

import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';

interface AdminAccountProps {
  name: string;
  role: string;
}

export function AdminAccount({ name, role }: AdminAccountProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-celadon-900 text-surface" aria-hidden="true">
        <ShieldCheck size={16} />
      </span>
      <div className="hidden max-w-40 leading-tight md:block">
        <p className="truncate text-sm font-medium text-text">{name}</p>
        <p className="text-xs text-text-muted">{role}</p>
      </div>
      <button
        type="button"
        className="rounded-sm p-2 text-text-muted hover:bg-bg hover:text-text disabled:opacity-50"
        aria-label="退出登录"
        title="退出登录"
        disabled={isSigningOut}
        onClick={signOut}
      >
        <LogOut size={17} />
      </button>
    </div>
  );
}
