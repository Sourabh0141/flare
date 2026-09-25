import { z } from 'zod';

/**
 * Emotions the assistant can express. Kept deliberately small: every value is a single token
 * for the LLM, and every value has a hand-tuned facial expression on the client.
 */
export const EMOTIONS = [
  'neutral',
  'happy',
  'excited',
  'amused',
  'sad',
  'surprised',
  'thoughtful',
  'concerned',
  'playful',
  'annoyed',
] as const;

export const emotionSchema = z.enum(EMOTIONS);
export type Emotion = z.infer<typeof emotionSchema>;

/**
 * Body gestures the character can perform while speaking. `nod` and `shake` are procedural
 * (head bone), the rest are animation clips shipped with the model.
 */
export const GESTURES = ['none', 'nod', 'shake', 'laugh', 'dance'] as const;

export const gestureSchema = z.enum(GESTURES);
export type Gesture = z.infer<typeof gestureSchema>;

export const DEFAULT_EMOTION: Emotion = 'neutral';
export const DEFAULT_GESTURE: Gesture = 'none';

export function isEmotion(value: unknown): value is Emotion {
  return emotionSchema.safeParse(value).success;
}

export function isGesture(value: unknown): value is Gesture {
  return gestureSchema.safeParse(value).success;
}
