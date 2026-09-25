import { cn } from '@/lib/utils';

/** Shown while the model downloads: a quiet warm silhouette, not a spinner. */
export function AvatarPlaceholder({
  className,
  label = 'Waking Flare',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('absolute inset-0 flex flex-col items-center justify-center gap-4', className)}
    >
      <div className="relative flex size-28 items-center justify-center">
        <div className="animate-breathe absolute inset-0 rounded-full bg-ember/20 blur-xl" />
        <div className="size-16 rounded-full bg-soot-raised ring-1 ring-ash" />
      </div>
      <span className="text-sm text-smoke">{label}</span>
    </div>
  );
}
