import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusKind =
  | 'draft'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'under_review'
  | 'rework'
  | 'accepted'
  | 'closed'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'applied'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | string;

const statusMap: Record<string, { label: string; classes: string }> = {
  draft: { label: '草稿', classes: 'bg-celadon-100 text-status-neutral' },
  open: { label: '开放申请', classes: 'bg-status-success/10 text-status-success' },
  assigned: { label: '已分配', classes: 'bg-status-info/10 text-status-info' },
  in_progress: { label: '进行中', classes: 'bg-status-info/10 text-status-info' },
  under_review: { label: '验收中', classes: 'bg-status-warning/10 text-status-warning' },
  rework: { label: '需返工', classes: 'bg-status-risk/10 text-status-risk' },
  accepted: { label: '已通过', classes: 'bg-status-success/10 text-status-success' },
  closed: { label: '已关闭', classes: 'bg-celadon-100 text-status-neutral' },
  pending: { label: '待审批', classes: 'bg-status-warning/10 text-status-warning' },
  approved: { label: '已批准', classes: 'bg-status-success/10 text-status-success' },
  rejected: { label: '已驳回', classes: 'bg-status-risk/10 text-status-risk' },
  modified: { label: '修改后批准', classes: 'bg-status-info/10 text-status-info' },
  applied: { label: '已申请', classes: 'bg-celadon-100 text-status-neutral' },
  queued: { label: '已排队', classes: 'bg-celadon-100 text-status-neutral' },
  running: { label: '运行中', classes: 'bg-status-info/10 text-status-info' },
  completed: { label: '已完成', classes: 'bg-status-success/10 text-status-success' },
  failed: { label: '运行失败', classes: 'bg-status-risk/10 text-status-risk' },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKind;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, classes: 'bg-celadon-100 text-text-muted' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        config.classes,
        className
      )}
      {...props}
    >
      {config.label}
    </span>
  );
}
