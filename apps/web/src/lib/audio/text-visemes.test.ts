import { describe, expect, it } from 'vitest';
import { blendVisemes, buildVisemeTimeline, graphemesOf, visemesAt } from './text-visemes';
import { SILENT_VISEMES, VISEME_NAMES } from './visemes';

describe('graphemesOf', () => {
  it('maps letters, digraphs, spaces and punctuation', () => {
    const shapes = graphemesOf('The cat.').map((g) => g.viseme);
    expect(shapes).toEqual([
      'viseme_TH',
      'viseme_E',
      'viseme_sil', // space
      'viseme_kk',
      'viseme_aa',
      'viseme_DD',
      'viseme_sil', // pause
    ]);
  });

  it('gives non-Latin scripts a syllable cycle instead of nothing', () => {
    const shapes = graphemesOf('こんにちは');
    expect(shapes.length).toBe(5);
    expect(new Set(shapes.map((g) => g.viseme)).size).toBeGreaterThan(1);
  });
});

describe('buildVisemeTimeline', () => {
  it('spans the audio duration in order with vowels held longer than consonants', () => {
    const timeline = buildVisemeTimeline('Hello there', 1.5);
    expect(timeline[0]?.start).toBeGreaterThan(0);
    expect(timeline.at(-1)?.end).toBeLessThanOrEqual(1.5);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i]!.start).toBeCloseTo(timeline[i - 1]!.end, 9);
    }
    const byViseme = Object.fromEntries(timeline.map((s) => [s.viseme, s.end - s.start]));
    expect(byViseme.viseme_E).toBeGreaterThan(byViseme.viseme_nn!);
  });

  it('returns nothing for empty text or a zero duration', () => {
    expect(buildVisemeTimeline('', 2)).toEqual([]);
    expect(buildVisemeTimeline('hi', 0)).toEqual([]);
  });
});

describe('visemesAt', () => {
  const timeline = buildVisemeTimeline('ma', 1);

  it('returns the active shape mid-span and silence outside', () => {
    const m = timeline[0]!;
    const mid = visemesAt(timeline, (m.start + m.end) / 2);
    expect(mid.viseme_PP).toBeCloseTo(1, 5);
    expect(mid.jawOpen).toBe(0);
    expect(visemesAt(timeline, 5)).toBe(SILENT_VISEMES);
  });

  it('crossfades across a boundary', () => {
    const boundary = timeline[0]!.end;
    const just = visemesAt(timeline, boundary + 0.005);
    expect(just.viseme_aa).toBeGreaterThan(0);
    expect(just.viseme_PP).toBeGreaterThan(0);
    expect(just.jawOpen).toBeGreaterThan(0);
  });
});

describe('blendVisemes', () => {
  it('lets text choose the shape and sound choose the strength', () => {
    const text = { ...SILENT_VISEMES, viseme_sil: 0, viseme_O: 1, jawOpen: 0.6 };
    const loud = { ...SILENT_VISEMES, viseme_sil: 0, viseme_aa: 0.5, jawOpen: 0.8 };
    const quiet = { ...SILENT_VISEMES, viseme_sil: 0 };
    expect(blendVisemes(text, loud).viseme_O).toBeGreaterThan(blendVisemes(text, quiet).viseme_O);
    expect(blendVisemes(text, loud).viseme_O).toBeGreaterThan(blendVisemes(text, loud).viseme_E);
    for (const name of VISEME_NAMES) {
      expect(blendVisemes(text, loud)[name]).toBeLessThanOrEqual(1);
    }
  });

  it('passes spectral shapes through when there is no timeline', () => {
    const spectral = { ...SILENT_VISEMES, viseme_aa: 0.4 };
    expect(blendVisemes(null, spectral)).toBe(spectral);
  });
});
