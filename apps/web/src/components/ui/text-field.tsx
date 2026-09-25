import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-linen">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
        }
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-10 rounded-md border bg-ink px-3 text-[15px] text-linen transition-colors placeholder:text-smoke',
          error ? 'border-rust' : 'border-ash hover:border-ash-soft focus:border-ember',
          'focus:outline-none disabled:opacity-60',
          className
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-rust">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-smoke">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
