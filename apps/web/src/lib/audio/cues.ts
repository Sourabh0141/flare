/**
 * Small synthesised tones for state changes: the microphone opening, a turn being sent, and
 * an error. Generated with an oscillator so there are no assets to load, and quiet enough to
 * sit under the voice.
 */
export type CueKind = 'listen' | 'sent' | 'error';

let context: AudioContext | null = null;
let enabled = true;

export function setCuesEnabled(value: boolean): void {
  enabled = value;
}

function ensureContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!context) context = new AudioContext();
  return context;
}

interface Note {
  from: number;
  to: number;
  durationMs: number;
  gain: number;
  type: OscillatorType;
}

const NOTES: Record<CueKind, Note> = {
  listen: { from: 620, to: 880, durationMs: 110, gain: 0.05, type: 'sine' },
  sent: { from: 880, to: 620, durationMs: 110, gain: 0.05, type: 'sine' },
  error: { from: 240, to: 200, durationMs: 180, gain: 0.06, type: 'triangle' },
};

export function playCue(kind: CueKind): void {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  const note = NOTES[kind];
  const now = ctx.currentTime;
  const seconds = note.durationMs / 1000;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = note.type;
  oscillator.frequency.setValueAtTime(note.from, now);
  oscillator.frequency.exponentialRampToValueAtTime(note.to, now + seconds);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(note.gain, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + seconds + 0.01);
}
