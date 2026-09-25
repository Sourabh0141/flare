import { describe, expect, it } from 'vitest';
import { encodeWav, peakRms } from './wav';

describe('encodeWav', () => {
  it('writes a valid RIFF header and 16-bit samples', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodeWav(samples, 16_000);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + samples.length * 2);

    const view = new DataView(await blob.arrayBuffer());
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(...new Uint8Array(view.buffer, offset, length));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(Math.round(0.5 * 0x7fff));
    expect(view.getInt16(50, true)).toBe(0x7fff);
    expect(view.getInt16(52, true)).toBe(-0x8000);
  });
});

describe('peakRms', () => {
  it('finds the loudest window', () => {
    const samples = new Float32Array(16_000);
    samples.fill(0.4, 8_000, 8_320);
    expect(peakRms(samples, 16_000)).toBeCloseTo(0.4, 2);
    expect(peakRms(new Float32Array(1000), 16_000)).toBe(0);
  });
});
