import * as React from 'react';
import type { AgentRun } from '@longyuan/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

export interface AgentRunSummaryProps {
  run: AgentRun;
  className?: string;
}

export function AgentRunSummary({ run, className }: AgentRunSummaryProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-6', className)}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={run.status} />
        <span className="text-sm text-text-muted">{run.runMode}</span>
      </div>
      <dl className="grid gap-3 text-sm">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">Job 类型</dt>
          <dd className="font-medium text-text">{run.jobType}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">模型</dt>
          <dd className="font-medium text-text">{run.modelName}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">Prompt 版本</dt>
          <dd className="font-medium text-text">{run.promptVersion}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">输入对象</dt>
          <dd className="font-medium text-text">{run.inputRef}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">Egress Manifest</dt>
          <dd className="font-medium text-text">{run.egressManifest}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">Token 用量</dt>
          <dd className="font-medium text-text">{run.tokensUsed.toLocaleString('zh-CN')}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">成本（USD）</dt>
          <dd className="font-medium text-text">${run.costUsd.toFixed(4)}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">输出 SHA256</dt>
          <dd className="font-mono text-xs text-text">{run.outputSha256}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <dt className="text-text-muted">开始时间</dt>
          <dd className="font-medium text-text">{new Date(run.startedAt).toLocaleString('zh-CN')}</dd>
        </div>
        {run.finishedAt && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-text-muted">结束时间</dt>
            <dd className="font-medium text-text">{new Date(run.finishedAt).toLocaleString('zh-CN')}</dd>
          </div>
        )}
        {run.failureReason && (
          <div className="rounded-md bg-status-risk/10 p-3 text-sm text-status-risk">
            <strong>失败原因：</strong>
            {run.failureReason}
          </div>
        )}
      </dl>
    </div>
  );
}
