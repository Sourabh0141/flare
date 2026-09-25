/**
 * Deterministic, frame-rate independent behaviours for the character. Pure functions and
 * small state machines so they can be unit tested without WebGL.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Exponential smoothing that behaves the same at 30 and 120 fps. */
export function damp(current: number, target: number, speed: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * delta));
}

// -----------------------------------------------------------------------------
// Blinking
// -----------------------------------------------------------------------------

export interface BlinkState {
  nextIn: number;
  progress: number;
  active: boolean;
}

export function createBlinkState(): BlinkState {
  return { nextIn: 1.5 + Math.random() * 3, progress: 0, active: false };
}

/** Advances the blink and returns the eyelid weight (0 open, 1 closed). */
export function stepBlink(state: BlinkState, delta: number, random = Math.random): number {
  if (!state.active) {
    state.nextIn -= delta;
    if (state.nextIn <= 0) {
      state.active = true;
      state.progress = 0;
    }
    return 0;
  }
  state.progress += delta * 11; // one blink is roughly 180 ms
  if (state.progress >= 2) {
    state.active = false;
    state.progress = 0;
    state.nextIn = 2 + random() * 4;
    return 0;
  }
  // Close fast, open slightly slower.
  return state.progress < 1 ? state.progress : Math.pow(2 - state.progress, 1.4);
}

// -----------------------------------------------------------------------------
// Gaze: where the eyes look, with occasional saccades so the stare is not fixed
// -----------------------------------------------------------------------------

export interface GazeTarget {
  /** Horizontal, -1 (character's right) .. 1 (character's left). */
  x: number;
  /** Vertical, -1 down .. 1 up. */
  y: number;
}

export interface GazeState {
  current: GazeTarget;
  offset: GazeTarget;
  nextSaccadeIn: number;
}

export function createGazeState(): GazeState {
  return { current: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, nextSaccadeIn: 1 };
}

export function stepGaze(
  state: GazeState,
  target: GazeTarget,
  delta: number,
  options: { wander: number; speed: number },
  random = Math.random
): GazeTarget {
  state.nextSaccadeIn -= delta;
  if (state.nextSaccadeIn <= 0) {
    state.offset = {
      x: (random() * 2 - 1) * options.wander,
      y: (random() * 2 - 1) * options.wander * 0.6,
    };
    state.nextSaccadeIn = 0.8 + random() * 2.4;
  }
  state.current = {
    x: clamp(damp(state.current.x, target.x + state.offset.x, options.speed, delta), -1, 1),
    y: clamp(damp(state.current.y, target.y + state.offset.y, options.speed, delta), -1, 1),
  };
  return state.current;
}

// -----------------------------------------------------------------------------
// Procedural head gestures (nod / shake) as damped sinusoids
// -----------------------------------------------------------------------------

export interface HeadGesture {
  kind: 'nod' | 'shake';
  elapsed: number;
  durationSec: number;
}

export function createHeadGesture(kind: 'nod' | 'shake'): HeadGesture {
  return { kind, elapsed: 0, durationSec: kind === 'nod' ? 0.9 : 1.1 };
}

/** Returns head rotation offsets in radians {pitch, yaw}; null when finished. */
export function stepHeadGesture(
  gesture: HeadGesture,
  delta: number
): { pitch: number; yaw: number } | null {
  gesture.elapsed += delta;
  if (gesture.elapsed >= gesture.durationSec) return null;
  const t = gesture.elapsed / gesture.durationSec;
  const envelope = Math.sin(Math.PI * t); // ease in and out
  if (gesture.kind === 'nod') {
    return { pitch: Math.sin(t * Math.PI * 4) * 0.12 * envelope, yaw: 0 };
  }
  return { pitch: 0, yaw: Math.sin(t * Math.PI * 5) * 0.14 * envelope };
}

// -----------------------------------------------------------------------------
// Breathing and idle sway
// -----------------------------------------------------------------------------

export function breathing(time: number): number {
  return Math.sin(time * 1.7) * 0.004;
}

export function idleSway(time: number): { x: number; y: number; z: number } {
  return {
    x: Math.sin(time * 0.37) * 0.012,
    y: Math.sin(time * 0.23) * 0.02,
    z: Math.sin(time * 0.31) * 0.008,
  };
}
