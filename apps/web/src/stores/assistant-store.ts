import { DEFAULT_EMOTION, DEFAULT_GESTURE, type Emotion, type Gesture } from '@flare/contracts';
import { create } from 'zustand';

/** What the character is doing right now. Drives lighting, posture and the controls. */
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Hands-free listening: off, actively waiting for speech, or muted by the user. */
export type HandsFreeMode = 'off' | 'listening' | 'muted';

export interface AssistantNotice {
  tone: 'info' | 'error';
  message: string;
}

export interface AssistantStore {
  state: AssistantState;
  emotion: Emotion;
  gesture: Gesture;
  /** How strongly the current emotion shows, 0..1. */
  intensity: number;
  /** Increments each time a gesture is requested so repeats of the same gesture replay. */
  gestureSeq: number;
  /** Microphone input level while listening, 0..1. */
  inputLevel: number;
  /** Id of the assistant message currently being spoken, if any. */
  speakingMessageId: string | null;
  notice: AssistantNotice | null;
  handsFree: HandsFreeMode;
  /** Which detector hands-free is using, for the interface to report. */
  detector: 'energy' | 'silero' | null;
  /** Turns left today as last reported by the API; null until the first turn. */
  turnsRemainingToday: number | null;

  setState: (state: AssistantState) => void;
  setInputLevel: (level: number) => void;
  express: (emotion: Emotion, gesture: Gesture, intensity?: number) => void;
  relax: () => void;
  setSpeakingMessage: (id: string | null) => void;
  notify: (notice: AssistantNotice | null) => void;
  setHandsFree: (mode: HandsFreeMode, detector?: 'energy' | 'silero' | null) => void;
  setTurnsRemaining: (turns: number | null) => void;
  reset: () => void;
}

const initial = {
  state: 'idle' as AssistantState,
  emotion: DEFAULT_EMOTION,
  gesture: DEFAULT_GESTURE,
  intensity: 0.5,
  gestureSeq: 0,
  inputLevel: 0,
  speakingMessageId: null,
  notice: null,
  handsFree: 'off' as HandsFreeMode,
  detector: null,
  turnsRemainingToday: null,
};

export const useAssistantStore = create<AssistantStore>((set) => ({
  ...initial,
  setState: (state) => set({ state }),
  setInputLevel: (inputLevel) => set({ inputLevel }),
  express: (emotion, gesture, intensity = 0.6) =>
    set((prev) => ({
      emotion,
      gesture,
      intensity: Math.min(1, Math.max(0, intensity)),
      gestureSeq: prev.gestureSeq + 1,
    })),
  relax: () => set({ emotion: DEFAULT_EMOTION, gesture: DEFAULT_GESTURE, intensity: 0.5 }),
  setSpeakingMessage: (speakingMessageId) => set({ speakingMessageId }),
  notify: (notice) => set({ notice }),
  setHandsFree: (handsFree, detector) =>
    set((prev) => ({ handsFree, detector: detector === undefined ? prev.detector : detector })),
  setTurnsRemaining: (turnsRemainingToday) => set({ turnsRemainingToday }),
  reset: () => set({ ...initial }),
}));

export const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};
