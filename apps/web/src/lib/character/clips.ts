import type { Emotion, Gesture } from '@flare/contracts';

/** Animation clip names inside animations.glb. */
export const CLIPS = {
  idle: 'Idle',
  talking: ['Talking_0', 'Talking_1', 'Talking_2'],
  laughing: 'Laughing',
  angry: 'Angry',
  crying: 'Crying',
  terrified: 'Terrified',
  rumba: 'Rumba',
} as const;

export interface ReactionClip {
  clip: string;
  /** Blend weight so strong clips read as a flicker of feeling rather than a performance. */
  weight: number;
  /** How long the clip plays before fading back, in seconds. */
  durationSec: number;
  fadeSec: number;
}

/** Full-body gesture clips. `nod` and `shake` are procedural and have no clip. */
export function clipForGesture(gesture: Gesture): ReactionClip | null {
  switch (gesture) {
    case 'laugh':
      return { clip: CLIPS.laughing, weight: 1, durationSec: 2.6, fadeSec: 0.35 };
    case 'dance':
      return { clip: CLIPS.rumba, weight: 1, durationSec: 6, fadeSec: 0.5 };
    default:
      return null;
  }
}

/** Emotions strong enough to move the body briefly when the reply starts. */
export function reactionForEmotion(emotion: Emotion): ReactionClip | null {
  switch (emotion) {
    case 'annoyed':
      return { clip: CLIPS.angry, weight: 0.6, durationSec: 1.8, fadeSec: 0.4 };
    case 'sad':
      return { clip: CLIPS.crying, weight: 0.45, durationSec: 2.2, fadeSec: 0.5 };
    case 'surprised':
      return { clip: CLIPS.terrified, weight: 0.4, durationSec: 1.1, fadeSec: 0.25 };
    default:
      return null;
  }
}

/**
 * Scales a reaction by how strongly the emotion is felt: a mild annoyance is a brief,
 * faint flicker; a strong one plays fuller and longer. Gestures asked for explicitly
 * (laugh, dance) keep their full weight and only shorten a little when mild.
 */
export function scaleReaction(
  clip: ReactionClip,
  intensity: number,
  explicit: boolean
): ReactionClip {
  const t = Math.min(1, Math.max(0, intensity));
  return {
    ...clip,
    weight: explicit ? clip.weight : clip.weight * (0.45 + 0.55 * t),
    durationSec: clip.durationSec * (explicit ? 0.85 + 0.15 * t : 0.6 + 0.6 * t),
  };
}

/** Picks a talking variant, never repeating the previous one. */
export function nextTalkingClip(previous: string | null): string {
  const options = CLIPS.talking.filter((clip) => clip !== previous);
  return options[Math.floor(Math.random() * options.length)] ?? CLIPS.talking[0];
}
