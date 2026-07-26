'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [activeId, setActiveId] = React.useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        role="tablist"
        aria-label="标签页"
        className="flex flex-wrap gap-2 border-b border-border"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              activeId === tab.id
                ? 'border-b-2 border-celadon-700 text-celadon-700'
                : 'text-text-muted hover:text-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab && (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
