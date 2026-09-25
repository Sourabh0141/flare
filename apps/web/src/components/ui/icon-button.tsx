import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; icons alone are not labels. */
  label: string;
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', tone = 'neutral', className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'size-8' : 'size-10',
        tone === 'danger'
          ? 'text-rust hover:bg-rust/15'
          : 'text-linen-dim hover:bg-soot-raised hover:text-linen',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
