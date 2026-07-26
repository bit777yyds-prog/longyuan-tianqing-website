import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/business/book-card';
import { TaskCard } from '@/components/business/task-card';
import { books } from '@/lib/fixtures/books';
import { tasks } from '@/lib/fixtures/tasks';

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-surface px-4 py-16 md:px-8 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-content">
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight text-text md:text-5xl lg:text-display">
              龙渊天青
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted md:text-xl">
              从青瓷出发，连接文学、历史、神话与当代数字文化。
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/books">查看系列书籍</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/tasks">参与开放任务</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Featured Books */}
        <section className="px-4 py-16 md:px-8 lg:px-16">
          <div className="mx-auto max-w-content">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-text md:text-h2">精选书籍</h2>
              <Link href="/books" className="text-sm font-medium text-celadon-700 hover:underline">
                查看全部
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {books.slice(0, 3).map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        </section>

        {/* Open Tasks */}
        <section className="border-t border-border bg-surface px-4 py-16 md:px-8 lg:px-16">
          <div className="mx-auto max-w-content">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-text md:text-h2">当前开放任务</h2>
              <Link href="/tasks" className="text-sm font-medium text-celadon-700 hover:underline">
                查看全部
              </Link>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tasks.slice(0, 3).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="px-4 py-16 md:px-8 lg:px-16">
          <div className="mx-auto max-w-reading">
            <h2 className="font-serif text-2xl font-semibold text-text md:text-h2">关于龙渊天青</h2>
            <p className="mt-6 text-base leading-relaxed text-text">
              龙渊天青是一家以青瓷文化为起点的内容研究与生产工作室。我们相信，传统工艺与当代数字文化之间的连接，需要扎实的研究、开放的协作与可审计的流程。
            </p>
            <p className="mt-4 text-base leading-relaxed text-text">
              在这里，你可以阅读我们出版的图书系列，也可以参与开放任务，与我们一起完成文献整理、视觉研究与数据校验等工作。
            </p>
            <div className="mt-8">
              <Button asChild variant="secondary">
                <Link href="/tasks">了解更多</Link>
              </Button>
            </div>
          </div>
        </section>
    </>
  );
}
