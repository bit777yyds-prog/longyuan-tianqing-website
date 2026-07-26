import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const checkboxId = id ?? React.useId();
    return (
      <div className={cn('flex items-start gap-3', className)}>
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded-sm border-border text-celadon-700',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
          )}
          {...props}
        />
        <div className="flex flex-col gap-0.5">
          <label htmlFor={checkboxId} className="text-sm font-medium text-text">
            {label}
          </label>
          {description && <p className="text-sm text-text-muted">{description}</p>}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';
