import { describe, expect, it } from 'vitest';
import { classifyRecording, levelFromRms, rmsOf, SILENCE_RMS_THRESHOLD } from './recorder';

describe('rmsOf', () => {
  it('is zero for silence and scales with amplitude', () => {
    expect(rmsOf(new Float32Array(64))).toBe(0);
    const quiet = rmsOf(new Float32Array(64).fill(0.1));
    const loud = rmsOf(new Float32Array(64).fill(0.5));
    expect(quiet).toBeCloseTo(0.1, 5);
    expect(loud).toBeGreaterThan(quiet);
  });
});

describe('levelFromRms', () => {
  it('maps quiet speech to a visible meter value and clamps at 1', () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(0.02)).toBeGreaterThan(0.1);
    expect(levelFromRms(5)).toBe(1);
  });
});

describe('classifyRecording', () => {
  const blob = new Blob([new Uint8Array(2048)], { type: 'audio/webm' });

  it('rejects taps that are too short', () => {
    expect(classifyRecording({ blob, durationMs: 120, peakLevel: 0.5 })).toBe('too_short');
  });

  it('rejects empty blobs', () => {
    expect(classifyRecording({ blob: new Blob([]), durationMs: 900, peakLevel: 0.5 })).toBe(
      'too_short'
    );
  });

  it('rejects silent recordings without a network call', () => {
    expect(classifyRecording({ blob, durationMs: 900, peakLevel: SILENCE_RMS_THRESHOLD / 2 })).toBe(
      'silent'
    );
  });

  it('accepts real speech', () => {
    expect(classifyRecording({ blob, durationMs: 900, peakLevel: 0.2 })).toBe('ok');
  });
});
