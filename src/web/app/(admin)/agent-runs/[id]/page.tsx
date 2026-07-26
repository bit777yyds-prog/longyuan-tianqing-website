import { notFound } from 'next/navigation';
import { agentRuns } from '@/lib/fixtures/agentRuns';
import { candidates } from '@/lib/fixtures/candidates';
import { AgentRunSummary } from '@/components/business/agent-run-summary';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

interface AgentRunPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentRunPage({ params }: AgentRunPageProps) {
  const { id } = await params;
  const run = agentRuns.find((r) => r.id === id);
  if (!run) notFound();

  const relatedCandidate = candidates.find((c) => c.agentVersion === run.promptVersion);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-text">Agent 运行详情</h1>
      <p className="mt-2 text-text-muted">{run.id}</p>

      <div className="mt-8">
        <AgentRunSummary run={run} />
      </div>

      <section className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold text-text">输出校验</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Schema 校验</dt>
            <dd className="font-medium text-text">通过</dd>
          </div>
          <div>
            <dt className="text-text-muted">语言校验</dt>
            <dd className="font-medium text-text">通过</dd>
          </div>
          <div>
            <dt className="text-text-muted">出站合规</dt>
            <dd className="font-medium text-text">{run.egressManifest}</dd>
          </div>
          <div>
            <dt className="text-text-muted">输出 SHA256</dt>
            <dd className="font-mono text-xs text-text">{run.outputSha256}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold text-text">关联候选</h2>
        {relatedCandidate ? (
          <div className="mt-4 flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <p className="font-medium text-text">{relatedCandidate.id}</p>
              <p className="text-sm text-text-muted">{relatedCandidate.proposedEventType}</p>
            </div>
            <StatusBadge status={relatedCandidate.status} />
            <Link
              href={`/candidates/${relatedCandidate.id}`}
              className="text-sm font-medium text-celadon-700 hover:underline"
            >
              查看审批
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-text-muted">暂无关联候选。</p>
        )}
      </section>
    </div>
  );
}
