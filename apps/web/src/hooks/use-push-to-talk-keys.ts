'use client';

import { useEffect } from 'react';
import { useAssistantStore } from '@/stores/assistant-store';

interface Handlers {
  onPress: () => void;
  onRelease: () => void;
  onInterrupt: () => void;
  /** Toggle hands-free mute with M. */
  onToggleMute?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/** Hold Space to talk, Escape to interrupt, M to mute in hands-free. Ignored while typing. */
export function usePushToTalkKeys({
  onPress,
  onRelease,
  onInterrupt,
  onToggleMute,
}: Handlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const { state, handsFree } = useAssistantStore.getState();
      if (event.code === 'Space' && !event.repeat) {
        if (handsFree !== 'off') return;
        event.preventDefault();
        if (state === 'idle' || state === 'speaking') onPress();
      } else if (event.code === 'Escape' && state !== 'idle') {
        event.preventDefault();
        onInterrupt();
      } else if (event.code === 'KeyM' && handsFree !== 'off' && onToggleMute) {
        event.preventDefault();
        onToggleMute();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const { state, handsFree } = useAssistantStore.getState();
      if (event.code === 'Space' && handsFree === 'off' && state === 'listening') {
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
  }, [onPress, onRelease, onInterrupt, onToggleMute]);
}
