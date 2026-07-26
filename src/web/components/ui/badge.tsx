import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'outline';
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        variant === 'neutral' && 'bg-celadon-100 text-celadon-900',
        variant === 'outline' && 'border border-border bg-surface text-text-muted',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
