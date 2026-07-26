import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-8 text-center',
        className
      )}
    >
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
