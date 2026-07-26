import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EvidenceItem {
  id: string;
  source: string;
  quote: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface EvidenceListProps {
  items: EvidenceItem[];
  className?: string;
}

const relevanceMap = {
  high: '高',
  medium: '中',
  low: '低',
};

const relevanceClasses = {
  high: 'text-status-risk',
  medium: 'text-status-warning',
  low: 'text-status-neutral',
};

export function EvidenceList({ items, className }: EvidenceListProps) {
  if (items.length === 0) {
    return (
      <p className={cn('text-sm text-text-muted', className)}>
        暂无证据引用。
      </p>
    );
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-md border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-muted">{item.source}</span>
            <span className={cn('text-xs font-medium', relevanceClasses[item.relevance])}>
              相关度：{relevanceMap[item.relevance]}
            </span>
          </div>
          <blockquote className="mt-2 border-l-2 border-celadon-500 pl-3 text-sm text-text">
            {item.quote}
          </blockquote>
        </li>
      ))}
    </ul>
  );
}
