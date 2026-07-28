import { RegisterForm } from './register-form';

export const metadata = {
  title: '受邀注册 - 龙渊天青',
};

interface RegisterPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const token = (await searchParams).token;
  const initialToken = typeof token === 'string' ? token : '';

  return (
    <section className="px-4 py-12 md:px-8 lg:px-16">
      <div className="mx-auto max-w-reading">
        <h1 className="font-serif text-3xl font-semibold text-text">受邀注册</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          注册需要管理员发出的有效邀请链接。邀请会限定邮箱和角色，并在使用后自动失效。
        </p>

        <RegisterForm initialToken={initialToken} />
      </div>
    </section>
  );
}
