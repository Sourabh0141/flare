import { describe, expect, it } from 'vitest';
import { DEFAULT_VAD_CONFIG, VadGate, type VadEvent } from './vad';

/** Drives the gate with a level for `ms` milliseconds at ~60 fps and collects events. */
function feed(gate: VadGate, level: number, ms: number, clock: { now: number }): VadEvent[] {
  const events: VadEvent[] = [];
  const end = clock.now + ms;
  while (clock.now < end) {
    clock.now += 16;
    const event = gate.update(level, clock.now);
    if (event) events.push(event);
  }
  return events;
}

describe('VadGate', () => {
  it('calibrates on room noise, then reports ready', () => {
    const gate = new VadGate();
    const clock = { now: 0 };
    const events = feed(gate, 0.004, DEFAULT_VAD_CONFIG.calibrationMs + 50, clock);
    expect(events.map((e) => e.type)).toEqual(['ready']);
    expect(gate.phase).toBe('idle');
    expect(gate.noiseFloor).toBeCloseTo(0.004, 3);
    expect(gate.threshold).toBeGreaterThan(gate.noiseFloor);
  });

  it('opens on sustained speech and closes after trailing silence', () => {
    const gate = new VadGate();
    const clock = { now: 0 };
    feed(gate, 0.004, DEFAULT_VAD_CONFIG.calibrationMs + 50, clock);

    const start = feed(gate, 0.2, 1200, clock);
    expect(start.map((e) => e.type)).toEqual(['speech_start']);
    expect(gate.phase).toBe('speaking');

    const end = feed(gate, 0.003, DEFAULT_VAD_CONFIG.releaseMs + 100, clock);
    expect(end).toHaveLength(1);
    expect(end[0]?.type).toBe('speech_end');
    if (end[0]?.type === 'speech_end') {
      expect(end[0].durationMs).toBeGreaterThan(1000);
      expect(end[0].durationMs).toBeLessThan(1400);
      expect(end[0].peakLevel).toBeCloseTo(0.2, 3);
    }
    expect(gate.phase).toBe('idle');
  });

  it('ignores brief blips shorter than the attack window', () => {
    const gate = new VadGate();
    const clock = { now: 0 };
    feed(gate, 0.004, DEFAULT_VAD_CONFIG.calibrationMs + 50, clock);
    const events = [
      ...feed(gate, 0.3, DEFAULT_VAD_CONFIG.attackMs - 40, clock),
      ...feed(gate, 0.003, 200, clock),
    ];
    expect(events).toHaveLength(0);
    expect(gate.phase).toBe('idle');
  });

  it('discards utterances shorter than the minimum speech length', () => {
    const gate = new VadGate();
    const clock = { now: 0 };
    feed(gate, 0.004, DEFAULT_VAD_CONFIG.calibrationMs + 50, clock);
    feed(gate, 0.3, 200, clock); // start (after attack) but far too short
    const events = feed(gate, 0.003, DEFAULT_VAD_CONFIG.releaseMs + 50, clock);
    expect(events.map((e) => e.type)).toEqual(['speech_discard']);
  });

  it('raises the threshold in a noisy room', () => {
    const quiet = new VadGate();
    const noisy = new VadGate();
    const c1 = { now: 0 };
    const c2 = { now: 0 };
    feed(quiet, 0.003, DEFAULT_VAD_CONFIG.calibrationMs + 50, c1);
    feed(noisy, 0.03, DEFAULT_VAD_CONFIG.calibrationMs + 50, c2);
    expect(noisy.threshold).toBeGreaterThan(quiet.threshold);
    // Speech at a level that would trigger in the quiet room does not in the noisy one.
    expect(feed(quiet, 0.04, 300, c1).map((e) => e.type)).toEqual(['speech_start']);
    expect(feed(noisy, 0.04, 300, c2)).toHaveLength(0);
  });

  it('hard-stops an utterance at the maximum length', () => {
    const gate = new VadGate({ ...DEFAULT_VAD_CONFIG, maxUtteranceMs: 2000 });
    const clock = { now: 0 };
    feed(gate, 0.004, DEFAULT_VAD_CONFIG.calibrationMs + 50, clock);
    const events = feed(gate, 0.2, 2500, clock);
    // The utterance is cut at 2 s; continued speech afterwards simply starts a new one.
    expect(events.slice(0, 2).map((e) => e.type)).toEqual(['speech_start', 'speech_end']);
    const end = events[1];
    if (end?.type === 'speech_end') expect(end.durationMs).toBeGreaterThanOrEqual(2000);
    expect(events[2]?.type).toBe('speech_start');
  });

  it('reset drops in-progress speech without emitting an event', () => {
    const gate = new VadGate();
    const clock = { now: 0 };
    feed(gate, 0.004, DEFAULT_VAD_CONFIG.calibrationMs + 50, clock);
    feed(gate, 0.2, 500, clock);
    expect(gate.phase).toBe('speaking');
    gate.reset();
    expect(gate.phase).toBe('idle');
    expect(feed(gate, 0.003, 1000, clock)).toHaveLength(0);
  });
});
