import { EMOTIONS, GESTURES } from '@flare/contracts';
import { describe, expect, it } from 'vitest';
import { VISEME_NAMES } from '../audio/visemes';
import { clipForGesture, nextTalkingClip, reactionForEmotion } from './clips';
import { EXPRESSIONS, EXPRESSION_SHAPES } from './expressions';

// Blend shapes present on the avatar model (public/models/avatar.glb).
const AVATAR_SHAPES = new Set([
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthPucker',
  'mouthShrugLower',
  'mouthShrugUpper',
  'noseSneerLeft',
  'noseSneerRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthLeft',
  'mouthRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'jawOpen',
  'mouthClose',
  'mouthFunnel',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'tongueOut',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
]);

describe('expression presets', () => {
  it('exist for every emotion with weights in 0..1', () => {
    for (const emotion of EMOTIONS) {
      const preset = EXPRESSIONS[emotion];
      expect(preset).toBeDefined();
      for (const [shape, weight] of Object.entries(preset)) {
        expect(weight, `${emotion}.${shape}`).toBeGreaterThanOrEqual(0);
        expect(weight, `${emotion}.${shape}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('only use shapes the avatar actually has', () => {
    for (const shape of EXPRESSION_SHAPES) {
      expect(AVATAR_SHAPES.has(shape), shape).toBe(true);
    }
  });

  it('never drive the lip-sync shapes, so a mood can hold while talking', () => {
    const lipShapes = new Set<string>(VISEME_NAMES);
    for (const shape of EXPRESSION_SHAPES) {
      expect(lipShapes.has(shape), shape).toBe(false);
    }
  });
});

describe('clip mapping', () => {
  it('maps every gesture to a clip or to a procedural gesture', () => {
    for (const gesture of GESTURES) {
      const clip = clipForGesture(gesture);
      if (gesture === 'laugh' || gesture === 'dance') expect(clip).not.toBeNull();
      else expect(clip).toBeNull();
    }
  });

  it('keeps strong emotional reactions under full weight', () => {
    for (const emotion of EMOTIONS) {
      const reaction = reactionForEmotion(emotion);
      if (reaction) expect(reaction.weight).toBeLessThan(1);
    }
  });

  it('never repeats the previous talking clip', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(nextTalkingClip('Talking_1')).not.toBe('Talking_1');
    }
  });
});
