'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="dialog-title" className="text-xl font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-text-muted">{description}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="关闭">
            ×
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
