import { SILENT_VISEMES, type VisemeName, type VisemeWeights } from './visemes';

/**
 * Grapheme-to-viseme timing. Given the text of a sentence and the duration of its audio,
 * builds a timeline of mouth shapes so the lips form the right shapes at roughly the right
 * moments. Spectral energy from the audio then drives how far the mouth opens, so the two
 * signals cover each other's weaknesses: timing from text, amplitude from sound.
 */

export interface VisemeSpan {
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  viseme: VisemeName;
  /** Vowels open the jaw; consonants mostly do not. */
  jaw: number;
}

export type VisemeTimeline = VisemeSpan[];

interface Grapheme {
  viseme: VisemeName;
  /** Relative duration, roughly proportional to how long the sound is held. */
  weight: number;
  jaw: number;
}

const VOWELS: Record<string, Grapheme> = {
  a: { viseme: 'viseme_aa', weight: 1, jaw: 0.75 },
  e: { viseme: 'viseme_E', weight: 0.9, jaw: 0.5 },
  i: { viseme: 'viseme_I', weight: 0.8, jaw: 0.35 },
  o: { viseme: 'viseme_O', weight: 1, jaw: 0.6 },
  u: { viseme: 'viseme_U', weight: 0.9, jaw: 0.35 },
  y: { viseme: 'viseme_I', weight: 0.6, jaw: 0.3 },
};

const CONSONANTS: Record<string, Grapheme> = {
  p: { viseme: 'viseme_PP', weight: 0.5, jaw: 0 },
  b: { viseme: 'viseme_PP', weight: 0.5, jaw: 0 },
  m: { viseme: 'viseme_PP', weight: 0.6, jaw: 0 },
  f: { viseme: 'viseme_FF', weight: 0.6, jaw: 0.1 },
  v: { viseme: 'viseme_FF', weight: 0.5, jaw: 0.1 },
  t: { viseme: 'viseme_DD', weight: 0.4, jaw: 0.15 },
  d: { viseme: 'viseme_DD', weight: 0.4, jaw: 0.15 },
  n: { viseme: 'viseme_nn', weight: 0.5, jaw: 0.1 },
  l: { viseme: 'viseme_nn', weight: 0.5, jaw: 0.2 },
  k: { viseme: 'viseme_kk', weight: 0.4, jaw: 0.2 },
  g: { viseme: 'viseme_kk', weight: 0.4, jaw: 0.2 },
  q: { viseme: 'viseme_kk', weight: 0.4, jaw: 0.2 },
  c: { viseme: 'viseme_kk', weight: 0.4, jaw: 0.2 },
  s: { viseme: 'viseme_SS', weight: 0.6, jaw: 0.1 },
  z: { viseme: 'viseme_SS', weight: 0.5, jaw: 0.1 },
  x: { viseme: 'viseme_SS', weight: 0.5, jaw: 0.1 },
  j: { viseme: 'viseme_CH', weight: 0.5, jaw: 0.15 },
  r: { viseme: 'viseme_RR', weight: 0.5, jaw: 0.2 },
  w: { viseme: 'viseme_U', weight: 0.5, jaw: 0.2 },
  h: { viseme: 'viseme_sil', weight: 0.3, jaw: 0.2 },
};

const DIGRAPHS: Record<string, Grapheme> = {
  th: { viseme: 'viseme_TH', weight: 0.6, jaw: 0.15 },
  sh: { viseme: 'viseme_CH', weight: 0.6, jaw: 0.1 },
  ch: { viseme: 'viseme_CH', weight: 0.6, jaw: 0.1 },
  ng: { viseme: 'viseme_nn', weight: 0.5, jaw: 0.1 },
};

const SPACE: Grapheme = { viseme: 'viseme_sil', weight: 0.45, jaw: 0 };
const PAUSE: Grapheme = { viseme: 'viseme_sil', weight: 1.3, jaw: 0 };
/** Scripts without letter-level rules cycle through open shapes at syllable pace. */
const SYLLABLE_CYCLE: Grapheme[] = [
  { viseme: 'viseme_aa', weight: 1, jaw: 0.6 },
  { viseme: 'viseme_I', weight: 0.8, jaw: 0.3 },
  { viseme: 'viseme_O', weight: 1, jaw: 0.55 },
  { viseme: 'viseme_E', weight: 0.8, jaw: 0.45 },
];

/** Turns text into a sequence of mouth shapes with relative weights. */
export function graphemesOf(text: string): Grapheme[] {
  const lower = text.toLowerCase();
  const out: Grapheme[] = [];
  let cycle = 0;
  for (let i = 0; i < lower.length; i += 1) {
    const two = lower.slice(i, i + 2);
    const digraph = DIGRAPHS[two];
    if (digraph) {
      out.push(digraph);
      i += 1;
      continue;
    }
    const ch = lower[i] ?? '';
    if (/\s/.test(ch)) {
      out.push(SPACE);
    } else if (/[.,;:!?…。！？、]/.test(ch)) {
      out.push(PAUSE);
    } else if (VOWELS[ch]) {
      out.push(VOWELS[ch]);
    } else if (CONSONANTS[ch]) {
      out.push(CONSONANTS[ch]);
    } else if (/\p{L}/u.test(ch)) {
      out.push(SYLLABLE_CYCLE[cycle % SYLLABLE_CYCLE.length]!);
      cycle += 1;
    }
    // Digits, symbols and emoji contribute nothing visible.
  }
  return out;
}

/**
 * Distributes the graphemes across `durationSec`. Leading and trailing pauses absorb the
 * synthesiser's own silence so the mouth does not move before the voice starts.
 */
export function buildVisemeTimeline(text: string, durationSec: number): VisemeTimeline {
  const graphemes = graphemesOf(text);
  if (graphemes.length === 0 || !(durationSec > 0)) return [];

  const lead = 0.06;
  const tail = 0.12;
  const speaking = Math.max(0.05, durationSec - lead - tail);
  const totalWeight = graphemes.reduce((sum, g) => sum + g.weight, 0);
  const unit = speaking / totalWeight;

  const timeline: VisemeTimeline = [];
  let cursor = lead;
  for (const grapheme of graphemes) {
    const length = grapheme.weight * unit;
    timeline.push({
      start: cursor,
      end: cursor + length,
      viseme: grapheme.viseme,
      jaw: grapheme.jaw,
    });
    cursor += length;
  }
  return timeline;
}

/**
 * Mouth shape at time `t`, with short crossfades at span boundaries so shapes flow rather
 * than snap. Returns silence outside the timeline.
 */
export function visemesAt(timeline: VisemeTimeline, t: number): VisemeWeights {
  const weights: VisemeWeights = { ...SILENT_VISEMES, viseme_sil: 0 };
  if (timeline.length === 0) return SILENT_VISEMES;

  // Binary search for the span containing t.
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid]!.end < t) lo = mid + 1;
    else hi = mid;
  }
  const span = timeline[lo]!;
  if (t < span.start || t > span.end) return SILENT_VISEMES;

  const blend = 0.03; // seconds of crossfade at each boundary
  const intoSpan = Math.min(1, (t - span.start) / blend);
  const outOfSpan = Math.min(1, (span.end - t) / blend);
  const own = Math.max(0, Math.min(intoSpan, outOfSpan));

  weights[span.viseme] = Math.max(weights[span.viseme], own);
  weights.jawOpen = span.jaw * own;

  const previous = timeline[lo - 1];
  if (previous && intoSpan < 1) {
    weights[previous.viseme] = Math.max(weights[previous.viseme], 1 - intoSpan);
    weights.jawOpen = Math.max(weights.jawOpen, previous.jaw * (1 - intoSpan));
  }
  const next = timeline[lo + 1];
  if (next && outOfSpan < 1) {
    weights[next.viseme] = Math.max(weights[next.viseme], 1 - outOfSpan);
    weights.jawOpen = Math.max(weights.jawOpen, next.jaw * (1 - outOfSpan));
  }
  return weights;
}

/**
 * Combines text-timed shapes with spectral energy: text decides which shape, sound decides
 * how strongly. Falls back to the spectral shapes alone when there is no timeline.
 */
export function blendVisemes(text: VisemeWeights | null, spectral: VisemeWeights): VisemeWeights {
  if (!text) return spectral;
  const energy = Math.min(1, spectral.jawOpen * 1.2 + spectral.viseme_aa * 0.4);
  const envelope = 0.25 + 0.75 * energy;
  const out = { ...SILENT_VISEMES, viseme_sil: 0 } as VisemeWeights;
  for (const name of Object.keys(out) as VisemeName[]) {
    if (name === 'jawOpen') continue;
    out[name] = Math.min(1, text[name] * envelope + spectral[name] * 0.35);
  }
  out.jawOpen = Math.min(1, Math.max(text.jawOpen * envelope, spectral.jawOpen * 0.8));
  out.viseme_sil = energy < 0.05 ? 0.6 : 0;
  return out;
}
