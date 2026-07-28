import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from './login-form';

export const metadata = { title: '登录 - 龙渊天青' };

export default function LoginPage() {
  return (
    <section className="px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={16} aria-hidden="true" />
          返回首页
        </Link>
        <div className="mt-8">
          <h1 className="font-serif text-3xl font-semibold text-text">登录龙渊天青</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">进入参与者中心或管理后台。</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-text-muted">
          尚未受邀？请联系项目管理员获取邀请链接。
        </p>
      </div>
    </section>
  );
}
