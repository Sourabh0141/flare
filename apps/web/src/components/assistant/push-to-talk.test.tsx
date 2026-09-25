import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssistantStore } from '@/stores/assistant-store';
import { PushToTalk } from './push-to-talk';

describe('PushToTalk', () => {
  beforeEach(() => useAssistantStore.getState().reset());

  it('starts on press and sends on release when idle', () => {
    const onPress = vi.fn();
    const onRelease = vi.fn();
    render(<PushToTalk onPress={onPress} onRelease={onRelease} onInterrupt={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Hold to talk' });
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, pointerType: 'mouse' });
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('interrupts on press while speaking', () => {
    useAssistantStore.getState().setState('speaking');
    const onInterrupt = vi.fn();
    render(<PushToTalk onPress={vi.fn()} onRelease={vi.fn()} onInterrupt={onInterrupt} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Interrupt Flare' }), {
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
    });
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it('is disabled and explains itself while thinking', () => {
    useAssistantStore.getState().setState('thinking');
    render(<PushToTalk onPress={vi.fn()} onRelease={vi.fn()} onInterrupt={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Flare is thinking' })).toBeDisabled();
    expect(screen.getByText('Press Escape to cancel')).toBeInTheDocument();
  });

  it('reflects the listening state', () => {
    useAssistantStore.getState().setState('listening');
    render(<PushToTalk onPress={vi.fn()} onRelease={vi.fn()} onInterrupt={vi.fn()} />);
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
    expect(screen.getByText('Let go to send')).toBeInTheDocument();
  });
});
