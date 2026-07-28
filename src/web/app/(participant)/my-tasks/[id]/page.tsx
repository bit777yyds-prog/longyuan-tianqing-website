import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { requireAuthenticatedUser } from '@/server/auth/authorization';
import { createDatabaseClient } from '@/server/db/client';
import { SqlMyTaskRepository } from '@/server/db/my-task-repository';
import { MyTaskService } from '@/server/domain/my-task-service';

interface MyTaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function MyTaskDetailPage({ params }: MyTaskDetailPageProps) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(await headers());
  const assignment = await new MyTaskService(
    new SqlMyTaskRepository(createDatabaseClient())
  ).findAssignedTask(user.actorId, id);
  if (!assignment) notFound();
  const { task } = assignment;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={assignment.assignmentStatus} />
        <Badge variant="outline">{task.type}</Badge>
      </div>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-text">{task.title}</h1>
      <p className="mt-1 text-text-muted">{task.project}</p>

      <dl className="mt-6 grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">交付物</dt>
          <dd className="font-medium text-text">{task.deliverable}</dd>
        </div>
        <div>
          <dt className="text-text-muted">截止时间</dt>
          <dd className="font-medium text-text">{task.deadline}</dd>
        </div>
        <div>
          <dt className="text-text-muted">报酬与版权</dt>
          <dd className="font-medium text-text">{task.reward}</dd>
        </div>
        <div>
          <dt className="text-text-muted">分配时间</dt>
          <dd className="font-medium text-text">{assignment.assignedAt.slice(0, 10)}</dd>
        </div>
      </dl>

      <Section title="任务目的">{task.description}</Section>
      <Section title="验收标准">
        <ItemList items={task.acceptanceCriteria} />
      </Section>
      <Section title="AI 使用规则">
        <ItemList items={task.aiRules} />
      </Section>
      <Section title="申请资格">
        <ItemList items={task.qualifications} />
      </Section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/my-tasks/${task.id}/submit`}>提交交付物</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/my-tasks">返回列表</Link>
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl font-semibold text-text">{title}</h2>
      <div className="mt-4 text-base leading-relaxed text-text">{children}</div>
    </section>
  );
}

function ItemList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-text-muted">按任务说明执行。</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
