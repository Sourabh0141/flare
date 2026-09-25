'use client';

import { useEffect } from 'react';
import { useAssistantStore } from '@/stores/assistant-store';

interface Handlers {
  onPress: () => void;
  onRelease: () => void;
  onInterrupt: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/** Hold Space to talk, Escape to interrupt. Ignored while typing in a field. */
export function usePushToTalkKeys({ onPress, onRelease, onInterrupt }: Handlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const { state } = useAssistantStore.getState();
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        if (state === 'idle' || state === 'speaking') onPress();
      } else if (event.code === 'Escape' && state !== 'idle') {
        event.preventDefault();
        onInterrupt();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.code === 'Space' && useAssistantStore.getState().state === 'listening') {
        event.preventDefault();
        onRelease();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onPress, onRelease, onInterrupt]);
}
