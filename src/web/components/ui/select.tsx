import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, id, required, ...props }, ref) => {
    const selectId = id ?? React.useId();
    const errorId = `${selectId}-error`;
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-status-risk">*</span>}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'rounded-md border bg-surface px-3 py-2 text-base text-text',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            error ? 'border-status-risk' : 'border-border'
          )}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          required={required}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="text-sm text-status-risk" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
