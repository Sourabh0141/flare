'use client';

import { STATE_LABELS, useAssistantStore, type AssistantState } from '@/stores/assistant-store';
import { cn } from '@/lib/utils';

const dotClass: Record<AssistantState, string> = {
  idle: 'bg-moss',
  listening: 'bg-ember animate-breathe',
  thinking: 'bg-dusk animate-breathe',
  speaking: 'bg-ember-soft',
};

export function StatusPill({ className }: { className?: string }) {
  const state = useAssistantStore((s) => s.state);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'type-ui inline-flex h-8 items-center gap-2 rounded-pill border border-ash/70 bg-soot/70 px-3 text-sm text-linen-dim backdrop-blur-sm',
        className
      )}
    >
      <span className={cn('size-2 rounded-full', dotClass[state])} aria-hidden="true" />
      {STATE_LABELS[state]}
    </div>
  );
}
