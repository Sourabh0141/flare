import { describe, expect, it } from 'vitest';
import {
  createBlinkState,
  createGazeState,
  createHeadGesture,
  damp,
  stepBlink,
  stepGaze,
  stepHeadGesture,
} from './behaviors';

describe('damp', () => {
  it('moves toward the target and is frame-rate independent', () => {
    const oneStep = damp(0, 1, 5, 0.1);
    const twoSteps = damp(damp(0, 1, 5, 0.05), 1, 5, 0.05);
    expect(oneStep).toBeGreaterThan(0);
    expect(oneStep).toBeLessThan(1);
    expect(twoSteps).toBeCloseTo(oneStep, 6);
  });
});

describe('stepBlink', () => {
  it('stays open until the timer elapses, then closes and reopens', () => {
    const state = createBlinkState();
    state.nextIn = 0.1;
    expect(stepBlink(state, 0.05, () => 0.5)).toBe(0);
    expect(stepBlink(state, 0.06, () => 0.5)).toBe(0); // transitions to active
    const closing = stepBlink(state, 0.05, () => 0.5);
    expect(closing).toBeGreaterThan(0);
    let peak = closing;
    let reopened = false;
    for (let i = 0; i < 40; i += 1) {
      const w = stepBlink(state, 0.016, () => 0.5);
      peak = Math.max(peak, w);
      if (w === 0 && !state.active) reopened = true;
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(reopened).toBe(true);
    expect(state.nextIn).toBeGreaterThanOrEqual(2);
  });
});

describe('stepGaze', () => {
  it('converges on the target and stays within bounds', () => {
    const state = createGazeState();
    let look = state.current;
    for (let i = 0; i < 200; i += 1) {
      look = stepGaze(state, { x: 0.6, y: -0.3 }, 0.016, { wander: 0, speed: 8 }, () => 0.5);
    }
    expect(look.x).toBeCloseTo(0.6, 2);
    expect(look.y).toBeCloseTo(-0.3, 2);
    for (let i = 0; i < 50; i += 1) {
      look = stepGaze(state, { x: 5, y: 5 }, 0.1, { wander: 1, speed: 20 }, () => 1);
    }
    expect(look.x).toBeLessThanOrEqual(1);
    expect(look.y).toBeLessThanOrEqual(1);
  });
});

describe('stepHeadGesture', () => {
  it('nods on pitch only, finishes, and returns to zero at the ends', () => {
    const nod = createHeadGesture('nod');
    const first = stepHeadGesture(nod, 0.001);
    expect(first).not.toBeNull();
    expect(Math.abs(first?.pitch ?? 1)).toBeLessThan(0.01);
    expect(first?.yaw).toBe(0);
    let sawMotion = false;
    let result: ReturnType<typeof stepHeadGesture> = first;
    while (result) {
      if (Math.abs(result.pitch) > 0.05) sawMotion = true;
      result = stepHeadGesture(nod, 0.05);
    }
    expect(sawMotion).toBe(true);
  });

  it('shakes on yaw only', () => {
    const shake = createHeadGesture('shake');
    const mid = stepHeadGesture(shake, shake.durationSec / 2 - 0.01);
    expect(mid?.pitch).toBe(0);
  });
});
