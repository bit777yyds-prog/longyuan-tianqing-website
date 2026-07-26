import { notFound } from 'next/navigation';
import Link from 'next/link';
import { books } from '@/lib/fixtures/books';
import { tasks } from '@/lib/fixtures/tasks';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;
  const book = books.find((b) => b.id === id);
  if (!book) notFound();

  const relatedTasks = tasks.filter((t) => t.project.includes(book.series));

  return (
    <div className="px-4 py-12 md:px-8 lg:px-16">
      <div className="mx-auto max-w-content">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="aspect-[3/4] w-full max-w-[320px] rounded-lg bg-celadon-100" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={book.status} />
              <Badge variant="outline">{book.series}</Badge>
            </div>
            <h1 className="mt-4 font-serif text-3xl font-semibold text-text md:text-h1">
              {book.title}
            </h1>
            <p className="mt-3 text-lg text-text-muted">{book.tagline}</p>
            {book.author && (
              <p className="mt-2 text-sm text-text-muted">
                {book.author} · {book.year}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button>阅读</Button>
              <Button variant="secondary">购买</Button>
              <Button variant="secondary" asChild>
                <Link href="/tasks">相关任务</Link>
              </Button>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-text">简介</h2>
          <p className="mt-4 max-w-reading leading-relaxed text-text">
            {book.description ?? '暂无简介。'}
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-text">相关任务</h2>
          {relatedTasks.length === 0 ? (
            <p className="mt-4 text-text-muted">暂无相关任务。</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {relatedTasks.map((task) => (
                <li key={task.id} className="rounded-md border border-border bg-surface p-4">
                  <Link href={`/tasks/${task.id}`} className="font-medium text-celadon-700 hover:underline">
                    {task.title}
                  </Link>
                  <p className="mt-1 text-sm text-text-muted">{task.deliverable}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
