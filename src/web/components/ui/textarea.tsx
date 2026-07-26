import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, required, ...props }, ref) => {
    const textareaId = id ?? React.useId();
    const errorId = `${textareaId}-error`;
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={textareaId} className="text-sm font-medium text-text">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-status-risk">*</span>}
        </label>
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'min-h-[120px] rounded-md border bg-surface px-3 py-2 text-base text-text placeholder:text-text-muted',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            error ? 'border-status-risk' : 'border-border'
          )}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          required={required}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-status-risk" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
