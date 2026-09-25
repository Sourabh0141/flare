'use client';

import { Ear } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/stores/assistant-store';

export interface HandsFreeToggleProps {
  onEnable: () => void;
  onDisable: () => void;
  className?: string;
}

/** Switch between hold-to-talk and hands-free listening. */
export function HandsFreeToggle({ onEnable, onDisable, className }: HandsFreeToggleProps) {
  const handsFree = useAssistantStore((s) => s.handsFree);
  const state = useAssistantStore((s) => s.state);
  const on = handsFree !== 'off';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={state === 'thinking'}
      onClick={on ? onDisable : onEnable}
      className={cn(
        'type-ui inline-flex h-9 items-center gap-2 rounded-pill border px-3 text-sm transition-colors disabled:opacity-60',
        on
          ? 'border-ember/60 bg-ember/15 text-ember-soft hover:bg-ember/25'
          : 'border-ash/70 bg-soot/70 text-linen-dim hover:border-ash-soft hover:text-linen',
        className
      )}
    >
      <Ear className="size-4" aria-hidden="true" />
      <span>Hands-free</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative ml-1 h-4 w-7 rounded-pill transition-colors',
          on ? 'bg-ember' : 'bg-ash'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-ink transition-transform',
            on ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  );
}
