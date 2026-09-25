'use client';

import { useEffect } from 'react';
import { STAGE_LIGHTS } from '@/lib/character/stage';
import { useAssistantStore } from '@/stores/assistant-store';

/** Mirrors the 3D stage light into CSS custom properties so the page glows with it. */
export function useStageGlow(): void {
  const state = useAssistantStore((s) => s.state);
  useEffect(() => {
    const preset = STAGE_LIGHTS[state];
    const root = document.documentElement;
    root.style.setProperty('--stage-glow', preset.glow);
    root.style.setProperty('--stage-glow-strength', String(preset.glowStrength));
    return () => {
      root.style.removeProperty('--stage-glow');
      root.style.removeProperty('--stage-glow-strength');
    };
  }, [state]);
}
