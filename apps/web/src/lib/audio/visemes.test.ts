import { describe, expect, it } from 'vitest';
import { SILENT_VISEMES, VISEME_NAMES, visemesFromSpectrum } from './visemes';

const SAMPLE_RATE = 48_000;
const FFT = 512;

function spectrumWithEnergy(ranges: Array<[number, number, number]>): Uint8Array {
  const bins = new Uint8Array(FFT / 2);
  const binHz = SAMPLE_RATE / FFT;
  for (const [lowHz, highHz, value] of ranges) {
    for (let i = Math.floor(lowHz / binHz); i < Math.ceil(highHz / binHz); i += 1) bins[i] = value;
  }
  return bins;
}

describe('visemesFromSpectrum', () => {
  it('returns silence for an empty spectrum', () => {
    expect(visemesFromSpectrum(new Uint8Array(FFT / 2), SAMPLE_RATE, FFT)).toBe(SILENT_VISEMES);
  });

  it('opens the jaw and favours open vowels for low-formant energy', () => {
    const weights = visemesFromSpectrum(spectrumWithEnergy([[80, 1100, 220]]), SAMPLE_RATE, FFT);
    expect(weights.jawOpen).toBeGreaterThan(0.4);
    expect(weights.viseme_aa).toBeGreaterThan(weights.viseme_SS);
    expect(weights.viseme_sil).toBe(0);
  });

  it('favours sibilants for high-frequency energy', () => {
    const weights = visemesFromSpectrum(spectrumWithEnergy([[2600, 6500, 230]]), SAMPLE_RATE, FFT);
    expect(weights.viseme_SS).toBeGreaterThan(weights.viseme_aa);
  });

  it('keeps every weight within 0..1', () => {
    const weights = visemesFromSpectrum(spectrumWithEnergy([[0, 8000, 255]]), SAMPLE_RATE, FFT);
    for (const name of VISEME_NAMES) {
      expect(weights[name]).toBeGreaterThanOrEqual(0);
      expect(weights[name]).toBeLessThanOrEqual(1);
    }
  });
});
