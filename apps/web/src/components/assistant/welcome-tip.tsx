'use client';

import { useEffect, useState } from 'react';
import { writePrefs, type DevicePrefs } from '@/lib/prefs';
import { Button } from '../ui/button';

export interface WelcomeTipProps {
  onDismiss: (withHandsFree: boolean) => void;
  initialPrefs: () => DevicePrefs;
}

/**
 * First visit only: how to talk, and the choice between holding the button and going
 * hands-free. Remembered per device; never shown again.
 */
export function WelcomeTip({ onDismiss, initialPrefs }: WelcomeTipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefs = initialPrefs();
    if (prefs.seenWelcome) {
      if (prefs.handsFreeByDefault) onDismiss(true);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [initialPrefs, onDismiss]);

  if (!visible) return null;

  const finish = (withHandsFree: boolean) => {
    writePrefs({ seenWelcome: true, handsFreeByDefault: withHandsFree });
    setVisible(false);
    onDismiss(withHandsFree);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="welcome-title"
      className="animate-rise-in absolute top-20 left-1/2 z-30 w-[min(92vw,26rem)] -translate-x-1/2 rounded-lg border border-ash bg-soot/95 p-5 shadow-lift backdrop-blur-md"
    >
      <h2 id="welcome-title" className="type-heading text-xl text-linen">
        Say hello to Flare
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-linen-dim">
        Hold the round button (or Space) while you talk and let go to send. Or go hands-free: the
        microphone stays open and Flare answers whenever you pause. Your browser will ask for
        microphone access the first time.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => finish(false)}>
          I&apos;ll hold the button
        </Button>
        <Button onClick={() => finish(true)}>Go hands-free</Button>
      </div>
    </div>
  );
}
