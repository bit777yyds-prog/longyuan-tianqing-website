import { notFound } from 'next/navigation';
import Link from 'next/link';
import { tasks } from '@/lib/fixtures/tasks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const task = tasks.find((t) => t.id === id);
  if (!task) notFound();

  return (
    <div className="px-4 py-12 md:px-8 lg:px-16">
      <div className="mx-auto max-w-task">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <Badge variant="outline">{task.type}</Badge>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-text md:text-h1">{task.title}</h1>
        <p className="mt-2 text-text-muted">{task.project}</p>

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
            <dt className="text-text-muted">剩余名额</dt>
            <dd className="font-medium text-text">{task.slotsRemaining}</dd>
          </div>
        </dl>

        <Section title="任务目的">{task.description}</Section>

        <Section title="验收标准">
          <ul className="list-disc space-y-1 pl-5 text-text">
            {task.acceptanceCriteria.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="AI 使用规则">
          <ul className="list-disc space-y-1 pl-5 text-text">
            {task.aiRules.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="申请资格">
          <ul className="list-disc space-y-1 pl-5 text-text">
            {task.qualifications.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="申请前确认">
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <Checkbox
              label="我确认有权提交所提供材料"
              description="提交内容不侵犯第三方版权或隐私。"
            />
            <Checkbox
              label="我同意按规则使用 AI 辅助"
              description="不将内部或保密材料上传至外部服务。"
            />
            <Checkbox
              label="我接受任务的报酬与版权约定"
              description="公开署名方式以任务说明为准。"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button>申请任务</Button>
            <Button variant="secondary" asChild>
              <Link href="/tasks">返回列表</Link>
            </Button>
          </div>
        </Section>

        <Section title="常见问题">
          <dl className="space-y-4">
            {task.faq.map((item, index) => (
              <div key={index}>
                <dt className="font-medium text-text">Q: {item.q}</dt>
                <dd className="mt-1 text-text-muted">A: {item.a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-semibold text-text">{title}</h2>
      <div className="mt-4 text-base leading-relaxed text-text">{children}</div>
    </section>
  );
}
