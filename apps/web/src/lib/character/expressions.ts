import { EMOTIONS, type Emotion } from '@flare/contracts';

/**
 * Facial expression presets as ARKit blend-shape weights. Only shapes that do not fight
 * the lip-sync (brows, eyes, cheeks, mouth corners) are used, so an expression can be held
 * while the character talks.
 */
export type ExpressionWeights = Readonly<Record<string, number>>;

const preset = (weights: Record<string, number>): ExpressionWeights => Object.freeze(weights);

export const EXPRESSIONS: Record<Emotion, ExpressionWeights> = {
  neutral: preset({
    mouthSmileLeft: 0.08,
    mouthSmileRight: 0.08,
  }),
  happy: preset({
    mouthSmileLeft: 0.55,
    mouthSmileRight: 0.55,
    cheekSquintLeft: 0.35,
    cheekSquintRight: 0.35,
    eyeSquintLeft: 0.2,
    eyeSquintRight: 0.2,
    browInnerUp: 0.1,
  }),
  excited: preset({
    mouthSmileLeft: 0.7,
    mouthSmileRight: 0.7,
    eyeWideLeft: 0.45,
    eyeWideRight: 0.45,
    browInnerUp: 0.45,
    browOuterUpLeft: 0.4,
    browOuterUpRight: 0.4,
    cheekSquintLeft: 0.2,
    cheekSquintRight: 0.2,
  }),
  amused: preset({
    mouthSmileLeft: 0.5,
    mouthSmileRight: 0.35,
    mouthDimpleLeft: 0.3,
    eyeSquintLeft: 0.3,
    eyeSquintRight: 0.2,
    browOuterUpLeft: 0.25,
    cheekSquintLeft: 0.3,
  }),
  sad: preset({
    mouthFrownLeft: 0.4,
    mouthFrownRight: 0.4,
    browInnerUp: 0.6,
    browDownLeft: 0.1,
    browDownRight: 0.1,
    eyeSquintLeft: 0.15,
    eyeSquintRight: 0.15,
    mouthPressLeft: 0.15,
    mouthPressRight: 0.15,
  }),
  surprised: preset({
    eyeWideLeft: 0.7,
    eyeWideRight: 0.7,
    browInnerUp: 0.6,
    browOuterUpLeft: 0.6,
    browOuterUpRight: 0.6,
    jawForward: 0.05,
  }),
  thoughtful: preset({
    browDownLeft: 0.25,
    browDownRight: 0.15,
    browInnerUp: 0.2,
    eyeSquintLeft: 0.25,
    eyeSquintRight: 0.15,
    mouthPressLeft: 0.3,
    mouthPressRight: 0.3,
    mouthLeft: 0.15,
  }),
  concerned: preset({
    browInnerUp: 0.55,
    browDownLeft: 0.2,
    browDownRight: 0.2,
    mouthFrownLeft: 0.2,
    mouthFrownRight: 0.2,
    mouthPressLeft: 0.2,
    mouthPressRight: 0.2,
    eyeWideLeft: 0.1,
    eyeWideRight: 0.1,
  }),
  playful: preset({
    mouthSmileLeft: 0.6,
    mouthSmileRight: 0.4,
    browOuterUpLeft: 0.45,
    browDownRight: 0.15,
    eyeSquintRight: 0.35,
    cheekSquintLeft: 0.3,
    noseSneerLeft: 0.1,
  }),
  annoyed: preset({
    browDownLeft: 0.55,
    browDownRight: 0.55,
    eyeSquintLeft: 0.35,
    eyeSquintRight: 0.35,
    mouthPressLeft: 0.35,
    mouthPressRight: 0.35,
    noseSneerLeft: 0.15,
    noseSneerRight: 0.15,
    mouthFrownLeft: 0.15,
    mouthFrownRight: 0.15,
  }),
};

/** Every blend shape any preset touches, so the driver can relax unused ones to zero. */
export const EXPRESSION_SHAPES: readonly string[] = Object.freeze(
  Array.from(new Set(EMOTIONS.flatMap((emotion) => Object.keys(EXPRESSIONS[emotion]))))
);

/** State-specific overlays applied on top of the emotion. */
export const STATE_OVERLAYS = {
  listening: preset({
    browInnerUp: 0.2,
    browOuterUpLeft: 0.15,
    browOuterUpRight: 0.15,
    eyeWideLeft: 0.1,
    eyeWideRight: 0.1,
  }),
  thinking: preset({
    browDownLeft: 0.2,
    browDownRight: 0.1,
    eyeSquintLeft: 0.15,
    mouthPressLeft: 0.2,
    mouthPressRight: 0.2,
    eyeLookUpLeft: 0.35,
    eyeLookUpRight: 0.35,
    eyeLookOutLeft: 0.2,
    eyeLookInRight: 0.2,
  }),
} as const;
