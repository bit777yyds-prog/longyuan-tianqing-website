import * as React from 'react';
import type { CandidateEvent } from '@longyuan/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

export interface CandidatePanelProps {
  candidate: CandidateEvent;
  className?: string;
}

export function CandidatePanel({ candidate, className }: CandidatePanelProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-6', className)}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={candidate.status} />
        <span className="text-sm text-text-muted">{candidate.proposedEventType}</span>
      </div>
      <dl className="grid gap-3 text-sm">
        <Definition term="Agent" value={candidate.agentName} />
        <Definition term="版本" value={candidate.agentVersion} />
        <Definition term="模型" value={candidate.modelName} />
        <Definition term="Prompt 版本" value={candidate.promptVersion} />
        <Definition term="出站等级" value={candidate.egressClass} />
        <Definition term="置信度" value={`${Math.round(candidate.confidence * 100)}%`} />
        <Definition term="Schema 校验" value={candidate.schemaValid ? '通过' : '未通过'} />
        <Definition term="语言校验" value={candidate.languageValid ? '通过' : '未通过'} />
        <Definition
          term="外部可控内容"
          value={candidate.containsExternalContent ? '包含' : '不包含'}
        />
        <Definition term="创建时间" value={new Date(candidate.createdAt).toLocaleString('zh-CN')} />
      </dl>
    </div>
  );
}

function Definition({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
      <dt className="text-text-muted">{term}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}
