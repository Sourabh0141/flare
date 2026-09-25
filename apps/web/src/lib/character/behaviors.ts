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
// Glances: every so often the character looks away for a moment, then returns
// -----------------------------------------------------------------------------

export interface GlanceState {
  nextIn: number;
  remaining: number;
  target: GazeTarget | null;
}

export function createGlanceState(random = Math.random): GlanceState {
  return { nextIn: 5 + random() * 8, remaining: 0, target: null };
}

/**
 * Returns a temporary gaze target while a glance is in progress, otherwise null. Glances
 * only happen while the character is idle or listening; callers skip this when busy.
 */
export function stepGlance(
  state: GlanceState,
  delta: number,
  random = Math.random
): GazeTarget | null {
  if (state.target) {
    state.remaining -= delta;
    if (state.remaining <= 0) {
      state.target = null;
      state.nextIn = 6 + random() * 9;
    }
    return state.target;
  }
  state.nextIn -= delta;
  if (state.nextIn <= 0) {
    state.target = {
      x: (random() < 0.5 ? -1 : 1) * (0.45 + random() * 0.4),
      y: (random() - 0.4) * 0.5,
    };
    state.remaining = 1 + random() * 1.2;
    return state.target;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Procedural head gestures (nod / shake) as damped sinusoids
// -----------------------------------------------------------------------------

export interface HeadGesture {
  kind: 'nod' | 'shake';
  elapsed: number;
  durationSec: number;
  /** 1 is a full gesture; listening acknowledgements use a fraction. */
  amplitude: number;
}

export function createHeadGesture(kind: 'nod' | 'shake', amplitude = 1): HeadGesture {
  return { kind, elapsed: 0, durationSec: kind === 'nod' ? 0.9 : 1.1, amplitude };
}

/** Returns head rotation offsets in radians {pitch, yaw}; null when finished. */
export function stepHeadGesture(
  gesture: HeadGesture,
  delta: number
): { pitch: number; yaw: number } | null {
  gesture.elapsed += delta;
  if (gesture.elapsed >= gesture.durationSec) return null;
  const t = gesture.elapsed / gesture.durationSec;
  const envelope = Math.sin(Math.PI * t) * gesture.amplitude; // ease in and out
  if (gesture.kind === 'nod') {
    return { pitch: Math.sin(t * Math.PI * 4) * 0.12 * envelope, yaw: 0 };
  }
  return { pitch: 0, yaw: Math.sin(t * Math.PI * 5) * 0.14 * envelope };
}

// -----------------------------------------------------------------------------
// Listening acknowledgements: react to the user's voice starting and rising
// -----------------------------------------------------------------------------

export interface OnsetState {
  wasAbove: boolean;
  cooldown: number;
}

export function createOnsetState(): OnsetState {
  return { wasAbove: false, cooldown: 0 };
}

/**
 * Fires when the input level crosses the threshold upwards, at most once per `cooldownSec`,
 * so the character nods when you start a thought rather than on every syllable.
 */
export function stepOnset(
  state: OnsetState,
  level: number,
  delta: number,
  threshold = 0.35,
  cooldownSec = 2.4
): boolean {
  state.cooldown = Math.max(0, state.cooldown - delta);
  const above = level >= threshold;
  const fired = above && !state.wasAbove && state.cooldown === 0;
  state.wasAbove = above;
  if (fired) state.cooldown = cooldownSec;
  return fired;
}

// -----------------------------------------------------------------------------
// Breathing, idle sway and weight shifts
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

/**
 * Slow weight shift from one hip to the other: a lateral drift with a matching lean so the
 * body reads as standing rather than floating. Period is long and irregular.
 */
export function weightShift(time: number): { offsetX: number; lean: number } {
  const phase = Math.sin(time * 0.11) * 0.7 + Math.sin(time * 0.043 + 1.3) * 0.3;
  return { offsetX: phase * 0.018, lean: -phase * 0.02 };
}
