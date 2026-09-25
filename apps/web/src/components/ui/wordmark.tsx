import { cn } from '@/lib/utils';

/** The Flare mark: a small flame drawn as two offset arcs, next to the name. */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <FlameGlyph className="size-6" />
      {!compact ? (
        <span className="type-ui text-[17px] font-semibold tracking-tight">Flare</span>
      ) : null}
    </span>
  );
}

export function FlameGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path
        d="M12 2.5c.6 3.2 3.3 4.7 4.8 7.2 1.9 3.2 1.4 7.3-1.6 9.8-2.9 2.4-7.4 2.2-10-.5-2.9-3-2.6-7.8.5-10.5.3 1.7 1.2 2.7 2.4 3.3-.2-3.5 1.5-6.6 3.9-9.3Z"
        fill="url(#flame)"
      />
      <path
        d="M12.2 11.2c.3 1.6 1.7 2.3 2.3 3.6.7 1.5.2 3.3-1.2 4.2-1.3.9-3.2.7-4.2-.5-1.1-1.3-.9-3.3.4-4.4.2.8.7 1.3 1.3 1.6-.2-1.7.4-3.2 1.4-4.5Z"
        fill="#15120f"
        fillOpacity="0.9"
      />
      <defs>
        <linearGradient id="flame" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7c491" />
          <stop offset="1" stopColor="#d9822f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
