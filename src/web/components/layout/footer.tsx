import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-content px-4 py-8 md:px-8 lg:px-16">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="font-serif text-lg font-semibold text-celadon-900">龙渊天青</p>
            <p className="mt-1 text-sm text-text-muted">从青瓷出发，连接文学、历史、神话与当代数字文化。</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm text-text-muted">
            <Link href="/books" className="hover:text-celadon-700">书籍</Link>
            <Link href="/tasks" className="hover:text-celadon-700">任务</Link>
            <Link href="/" className="hover:text-celadon-700">关于我们</Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-border pt-4 text-xs text-text-muted">
          © {new Date().getFullYear()} 龙渊天青. 保留所有权利。
        </div>
      </div>
    </footer>
  );
}
