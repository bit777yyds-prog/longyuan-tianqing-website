import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  asChild?: boolean;
}

const variants = {
  primary:
    'bg-celadon-900 text-surface border border-celadon-900 hover:bg-celadon-700 focus:ring-celadon-700',
  secondary:
    'bg-surface text-celadon-900 border border-celadon-700 hover:bg-celadon-100 focus:ring-celadon-700',
  danger:
    'bg-surface text-kiln-700 border border-kiln-700 hover:bg-kiln-100 focus:ring-kiln-700',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-sm',
  md: 'px-4 py-2 text-base rounded-md',
  lg: 'px-6 py-3 text-lg rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, asChild, ...props }, ref) => {
    const classes = cn(
      'inline-flex items-center justify-center font-sans font-medium transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        className: cn(classes, children.props.className),
        'aria-busy': isLoading || undefined,
        ...props,
      } as React.Attributes);
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
