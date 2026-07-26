import * as React from 'react';
import Link from 'next/link';
import type { Task } from '@longyuan/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface TaskCardProps {
  task: Task;
  className?: string;
}

export function TaskCard({ task, className }: TaskCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col rounded-lg border border-border bg-surface p-6 transition-colors hover:border-celadon-500',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <StatusBadge status={task.status} />
        <Badge variant="outline">{task.type}</Badge>
      </div>
      <h3 className="mt-3 font-serif text-xl font-semibold text-text">
        <Link href={`/tasks/${task.id}`} className="hover:text-celadon-700">
          {task.title}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-text-muted">{task.project}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-text-muted">交付物</dt>
          <dd className="text-text">{task.deliverable}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">截止时间</dt>
          <dd className="text-text">{task.deadline}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">报酬</dt>
          <dd className="text-text">{task.reward}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">剩余名额</dt>
          <dd className="text-text">{task.slotsRemaining}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <Button asChild variant="secondary" size="sm" className="w-full">
          <Link href={`/tasks/${task.id}`}>查看任务</Link>
        </Button>
      </div>
    </article>
  );
}
