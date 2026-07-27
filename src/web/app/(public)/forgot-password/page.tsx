import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const metadata = { title: '找回密码 - 龙渊天青' };

export default function ForgotPasswordPage() {
  return (
    <section className="px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"><ArrowLeft size={16} />返回登录</Link>
        <h1 className="mt-8 font-serif text-3xl font-semibold text-text">找回密码</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">输入账号邮箱，我们会发送重置链接。</p>
        <form className="mt-8 border border-border bg-surface p-6">
          <Input label="邮箱" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
          <Button type="button" className="mt-6 w-full gap-2"><Mail size={17} />发送重置链接</Button>
        </form>
      </div>
    </section>
  );
}
