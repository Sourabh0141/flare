import { DEFAULT_EMOTION, DEFAULT_GESTURE, type Emotion, type Gesture } from '@flare/contracts';
import { create } from 'zustand';

/** What the character is doing right now. Drives lighting, posture and the controls. */
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface AssistantNotice {
  tone: 'info' | 'error';
  message: string;
}

export interface AssistantStore {
  state: AssistantState;
  emotion: Emotion;
  gesture: Gesture;
  /** Increments each time a gesture is requested so repeats of the same gesture replay. */
  gestureSeq: number;
  /** Microphone input level while listening, 0..1. */
  inputLevel: number;
  /** Id of the assistant message currently being spoken, if any. */
  speakingMessageId: string | null;
  notice: AssistantNotice | null;

  setState: (state: AssistantState) => void;
  setInputLevel: (level: number) => void;
  express: (emotion: Emotion, gesture: Gesture) => void;
  relax: () => void;
  setSpeakingMessage: (id: string | null) => void;
  notify: (notice: AssistantNotice | null) => void;
  reset: () => void;
}

const initial = {
  state: 'idle' as AssistantState,
  emotion: DEFAULT_EMOTION,
  gesture: DEFAULT_GESTURE,
  gestureSeq: 0,
  inputLevel: 0,
  speakingMessageId: null,
  notice: null,
};

export const useAssistantStore = create<AssistantStore>((set) => ({
  ...initial,
  setState: (state) => set({ state }),
  setInputLevel: (inputLevel) => set({ inputLevel }),
  express: (emotion, gesture) =>
    set((prev) => ({ emotion, gesture, gestureSeq: prev.gestureSeq + 1 })),
  relax: () => set({ emotion: DEFAULT_EMOTION, gesture: DEFAULT_GESTURE }),
  setSpeakingMessage: (speakingMessageId) => set({ speakingMessageId }),
  notify: (notice) => set({ notice }),
  reset: () => set({ ...initial }),
}));

export const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};
