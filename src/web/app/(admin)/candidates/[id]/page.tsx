import { notFound } from 'next/navigation';
import { candidates } from '@/lib/fixtures/candidates';
import { tasks } from '@/lib/fixtures/tasks';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { CandidatePanel } from '@/components/business/candidate-panel';
import { EvidenceList } from '@/components/business/evidence-list';

interface CandidatePageProps {
  params: Promise<{ id: string }>;
}

const evidenceItems = [
  {
    id: 'ev-001',
    source: 'task-001 验收标准 #1',
    quote: '每条文献包含标题、作者、出处、年代、关键词与摘要。',
    relevance: 'high' as const,
  },
  {
    id: 'ev-002',
    source: 'task-001 交付物 v3',
    quote: '部分条目缺少原始出处页码，需补充或标注为存疑。',
    relevance: 'medium' as const,
  },
  {
    id: 'ev-003',
    source: 'review-prompt-v12',
    quote: '输出格式符合 schema，语言校验通过，未发现外部可控内容。',
    relevance: 'low' as const,
  },
];

export default async function CandidatePage({ params }: CandidatePageProps) {
  const { id } = await params;
  const candidate = candidates.find((c) => c.id === id);
  if (!candidate) notFound();

  const task = tasks[0];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={candidate.status} />
        <span className="text-sm text-text-muted">{candidate.proposedEventType}</span>
        <span className="text-sm text-text-muted">Agent {candidate.agentVersion}</span>
      </div>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-text">候选审批</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Original requirements */}
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-text">原始任务要求</h2>
          <div className="mt-4 space-y-4 text-sm">
            <p className="text-text">{task.description}</p>
            <div>
              <p className="font-medium text-text">验收标准</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">
                {task.acceptanceCriteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Deliverable */}
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-text">原始交付物</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium text-text">版本</p>
              <p className="text-text-muted">task-001/deliverable-v3</p>
            </div>
            <div>
              <p className="font-medium text-text">文件</p>
              <p className="text-text-muted">deliverable-v3.csv</p>
            </div>
            <div>
              <p className="font-medium text-text">提交说明</p>
              <p className="text-text-muted">完成 120 条文献整理，其中 8 条因出处不明标注为存疑。</p>
            </div>
          </div>
        </section>

        {/* Agent recommendation */}
        <CandidatePanel candidate={candidate} />
      </div>

      <section className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold text-text">证据引用</h2>
        <div className="mt-4">
          <EvidenceList items={evidenceItems} />
        </div>
      </section>

      <section className="mt-8 flex flex-wrap gap-3">
        <Button>批准</Button>
        <Button variant="secondary">修改后批准</Button>
        <Button variant="danger">驳回</Button>
        <Button variant="secondary">要求重新运行</Button>
      </section>
    </div>
  );
}
