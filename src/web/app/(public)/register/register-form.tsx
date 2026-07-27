'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RegisterFormProps {
  initialToken: string;
}

export function RegisterForm({ initialToken }: RegisterFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [registeredEmail, setRegisteredEmail] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email') ?? '');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: formData.get('token'),
          email,
          displayName: formData.get('displayName'),
          password: formData.get('password'),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '注册失败，请稍后重试');
      setRegisteredEmail(email);
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '注册失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-surface p-6" role="status">
        <h2 className="font-serif text-xl font-semibold text-text">账号创建成功</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {registeredEmail} 已完成注册。登录功能将在认证会话接通后开放。
        </p>
        <Button asChild type="button" variant="secondary" className="mt-5">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="mt-8 rounded-lg border border-border bg-surface p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <Input
          label="邀请令牌"
          name="token"
          defaultValue={initialToken}
          placeholder="粘贴邀请链接中的 token"
          autoComplete="off"
          required
        />
        <Input label="邮箱" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
        <Input label="显示名称" name="displayName" placeholder="用于任务和审计记录" autoComplete="name" required />
        <Input label="密码" name="password" type="password" autoComplete="new-password" minLength={12} required />
      </div>
      {error && <p className="mt-4 text-sm text-status-risk" role="alert">{error}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" isLoading={isSubmitting}>创建账号</Button>
        <Button asChild type="button" variant="secondary">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    </form>
  );
}
