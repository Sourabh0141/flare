'use client';

import { Mic, Square } from 'lucide-react';
import { useRef, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { useAssistantStore, type AssistantState } from '@/stores/assistant-store';
import { Spinner } from '../ui/spinner';

export interface PushToTalkProps {
  onPress: () => void;
  onRelease: () => void;
  onInterrupt: () => void;
  className?: string;
}

const captions: Record<AssistantState, { primary: string; secondary: string }> = {
  idle: { primary: 'Hold to talk', secondary: 'Or hold Space on your keyboard' },
  listening: { primary: 'Listening', secondary: 'Let go to send' },
  thinking: { primary: 'Thinking', secondary: 'Press Escape to cancel' },
  speaking: { primary: 'Speaking', secondary: 'Tap to interrupt, or hold to reply' },
};

/**
 * The one control that matters. Press-and-hold on pointer or Space; the ring around the
 * button shows microphone level while listening and playback while speaking.
 */
export function PushToTalk({ onPress, onRelease, onInterrupt, className }: PushToTalkProps) {
  const state = useAssistantStore((s) => s.state);
  const level = useAssistantStore((s) => s.inputLevel);
  const holdStarted = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    if (state === 'thinking') return;
    if (state === 'speaking') {
      onInterrupt();
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a nicety; the hold still works without it.
    }
    holdStarted.current = true;
    onPress();
  };

  const finishHold = (event: PointerEvent<HTMLButtonElement>) => {
    if (!holdStarted.current) return;
    holdStarted.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore.
    }
    onRelease();
  };

  const caption = captions[state];
  const ringScale = state === 'listening' ? 1 + level * 0.5 : 1;

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative flex size-24 items-center justify-center">
        {state === 'listening' ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-ember/25 transition-transform duration-75 ease-out"
            style={{ transform: `scale(${ringScale})` }}
          />
        ) : null}
        {state === 'speaking' ? (
          <span
            aria-hidden="true"
            className="animate-breathe absolute inset-0 rounded-full bg-ember-soft/20"
          />
        ) : null}
        {state === 'thinking' ? (
          <span
            aria-hidden="true"
            className="absolute inset-1 animate-spin rounded-full border-2 border-dusk/20 border-t-dusk"
            style={{ animationDuration: '1.4s' }}
          />
        ) : null}

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={finishHold}
          onPointerCancel={finishHold}
          onLostPointerCapture={finishHold}
          onContextMenu={(event) => event.preventDefault()}
          disabled={state === 'thinking'}
          aria-label={
            state === 'speaking'
              ? 'Interrupt Flare'
              : state === 'listening'
                ? 'Recording. Release to send.'
                : state === 'thinking'
                  ? 'Flare is thinking'
                  : 'Hold to talk'
          }
          aria-pressed={state === 'listening'}
          className={cn(
            'relative z-10 flex size-[4.5rem] touch-none items-center justify-center rounded-full shadow-lift transition-[transform,background-color] duration-200 select-none',
            'focus-visible:outline-offset-4',
            state === 'listening' && 'scale-105 bg-ember text-ink',
            state === 'thinking' && 'cursor-progress bg-soot-raised text-dusk',
            state === 'speaking' &&
              'bg-soot-raised text-ember-soft ring-1 ring-ember/50 hover:bg-ash',
            state === 'idle' && 'bg-ember text-ink hover:bg-ember-soft active:scale-95'
          )}
        >
          {state === 'thinking' ? (
            <Spinner className="size-7" />
          ) : state === 'speaking' ? (
            <Square className="size-6 fill-current" />
          ) : (
            <Mic className="size-7" />
          )}
        </button>
      </div>

      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="type-ui text-[15px] font-medium text-linen">{caption.primary}</span>
        <span className="text-sm text-smoke">{caption.secondary}</span>
      </div>
    </div>
  );
}
