import Link from 'next/link';
import { headers } from 'next/headers';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireAuthenticatedUser } from '@/server/auth/authorization';
import { createDatabaseClient } from '@/server/db/client';
import { SqlMyTaskRepository } from '@/server/db/my-task-repository';
import { MyTaskService } from '@/server/domain/my-task-service';

export const metadata = {
  title: '我的任务 - 龙渊天青',
};

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
  const user = await requireAuthenticatedUser(await headers());
  const dashboard = await new MyTaskService(
    new SqlMyTaskRepository(createDatabaseClient())
  ).listDashboard(user.actorId);
  const summary = [
    { label: '待提交', count: dashboard.summary.assigned },
    { label: '进行中', count: dashboard.summary.inProgress },
    { label: '验收中', count: dashboard.summary.underReview },
    { label: '需返工', count: dashboard.summary.rework },
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
        {dashboard.assignedTasks.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="还没有任务"
            description="浏览开放任务并提交申请，审核通过后会出现在这里。"
            action={
              <Button asChild>
                <Link href="/tasks">浏览任务</Link>
              </Button>
            }
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {dashboard.assignedTasks.map((item) => (
              <li
                key={item.assignmentId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.assignmentStatus} />
                    <span className="text-sm text-text-muted">{item.task.project}</span>
                  </div>
                  <h3 className="mt-1 font-medium text-text">{item.task.title}</h3>
                  <p className="text-sm text-text-muted">截止：{item.task.deadline}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/my-tasks/${item.task.id}`}>详情</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/my-tasks/${item.task.id}/submit`}>提交</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold text-text">我的申请</h2>
        {dashboard.applications.length === 0 ? (
          <EmptyState className="mt-4" title="还没有申请记录" description="申请开放任务后可在这里查看处理状态。" />
        ) : (
          <ul className="mt-4 space-y-3">
            {dashboard.applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={application.status} />
                    <span className="text-sm text-text-muted">{application.project}</span>
                  </div>
                  <h3 className="mt-1 font-medium text-text">{application.taskTitle}</h3>
                  <p className="text-sm text-text-muted">
                    申请时间：{application.createdAt.slice(0, 10)}
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={application.status === 'accepted' ? `/my-tasks/${application.taskId}` : `/tasks/${application.taskId}`}>
                    查看任务
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
