import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-ember text-ink hover:bg-ember-soft active:bg-ember-deep disabled:bg-ash disabled:text-smoke',
  secondary:
    'bg-soot-raised text-linen border border-ash hover:border-ash-soft hover:bg-ash/60 disabled:text-smoke',
  ghost: 'text-linen-dim hover:text-linen hover:bg-soot-raised disabled:text-smoke',
  danger: 'bg-rust/15 text-rust border border-rust/30 hover:bg-rust/25 disabled:text-smoke',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'type-ui inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 select-none disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});
