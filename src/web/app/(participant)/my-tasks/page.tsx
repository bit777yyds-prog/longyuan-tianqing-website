import Link from 'next/link';
import { tasks } from '@/lib/fixtures/tasks';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = {
  title: '我的任务 - 龙渊天青',
};

export default function MyTasksPage() {
  const summary = [
    { label: '进行中', count: 1 },
    { label: '待提交', count: 0 },
    { label: '验收中', count: 1 },
    { label: '需返工', count: 0 },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-text">我的任务</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-semibold text-celadon-900">{item.count}</p>
            <p className="mt-1 text-sm text-text-muted">{item.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold text-text">任务列表</h2>
        {tasks.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="还没有任务"
            description="浏览开放任务并提交第一份申请。"
            action={
              <Button asChild>
                <Link href="/tasks">浏览任务</Link>
              </Button>
            }
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    <span className="text-sm text-text-muted">{task.project}</span>
                  </div>
                  <h3 className="mt-1 font-medium text-text">{task.title}</h3>
                  <p className="text-sm text-text-muted">截止：{task.deadline}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/tasks/${task.id}`}>详情</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/my-tasks/${task.id}/submit`}>提交</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
