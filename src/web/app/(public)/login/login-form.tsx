'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
          rememberMe: formData.get('rememberMe') === 'on',
        }),
      });
      if (!response.ok) throw new Error('邮箱或密码不正确');
      window.location.assign('/admin');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 border border-border bg-surface p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <Input label="邮箱" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        <Input label="密码" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <Checkbox label="保持登录" name="rememberMe" />
        <Link href="/forgot-password" className="shrink-0 text-sm font-medium text-celadon-700 hover:underline">忘记密码</Link>
      </div>
      {error && <p className="mt-4 text-sm text-status-risk" role="alert">{error}</p>}
      <Button type="submit" className="mt-6 w-full gap-2" isLoading={isSubmitting}>
        <LogIn size={17} aria-hidden="true" />
        登录
      </Button>
    </form>
  );
}
