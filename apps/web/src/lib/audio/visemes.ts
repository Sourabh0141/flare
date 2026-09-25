/**
 * Real-time lip-sync from the playback spectrum. Frequency-band energies are mapped to
 * ARKit viseme blend shapes. It is an approximation, not phoneme alignment, but it runs
 * entirely in the browser at frame rate with no server cost.
 */

export const VISEME_NAMES = [
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
  'jawOpen',
] as const;

export type VisemeName = (typeof VISEME_NAMES)[number];
export type VisemeWeights = Record<VisemeName, number>;

export const SILENT_VISEMES: VisemeWeights = Object.freeze(
  Object.fromEntries(VISEME_NAMES.map((name) => [name, name === 'viseme_sil' ? 1 : 0]))
) as VisemeWeights;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Average normalised energy (0..1) across the bins covering [lowHz, highHz).
 */
function bandEnergy(spectrum: Uint8Array, binHz: number, lowHz: number, highHz: number): number {
  const start = Math.max(0, Math.floor(lowHz / binHz));
  const end = Math.min(spectrum.length, Math.ceil(highHz / binHz));
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += spectrum[i] ?? 0;
  return sum / (end - start) / 255;
}

/**
 * @param spectrum byte frequency data from an AnalyserNode
 * @param sampleRate the AudioContext sample rate
 * @param fftSize the analyser's fftSize (spectrum.length === fftSize / 2)
 */
export function visemesFromSpectrum(
  spectrum: Uint8Array,
  sampleRate: number,
  fftSize: number
): VisemeWeights {
  const binHz = sampleRate / fftSize;
  const low = bandEnergy(spectrum, binHz, 80, 400); // voicing, jaw
  const f1 = bandEnergy(spectrum, binHz, 400, 1100); // open vowels
  const f2 = bandEnergy(spectrum, binHz, 1100, 2600); // front vowels
  const high = bandEnergy(spectrum, binHz, 2600, 6500); // fricatives
  const overall = bandEnergy(spectrum, binHz, 80, 4000);

  if (overall < 0.05) return SILENT_VISEMES;

  const jawOpen = clamp01((overall * 1.4 + low * 0.7) * 0.85);
  const aa = clamp01((f1 * 1.6 + low * 0.4) * 0.8);
  const O = clamp01((low * 1.3 + f1 * 0.4) * 0.7);
  const E = clamp01((f1 * 0.7 + f2 * 1.1) * 0.7);
  const I = clamp01((f2 * 1.4 + high * 0.4) * 0.65);
  const U = clamp01((low * 0.9 + f2 * 0.5) * 0.55);
  const SS = clamp01(high * 1.7 * 0.6);
  const FF = clamp01((high * 1.1 + f2 * 0.3) * 0.45);
  const TH = clamp01((f2 * 0.8 + high * 0.7) * 0.45);
  const PP = overall > 0.4 && low > 0.45 ? 0.3 : 0;

  return {
    viseme_sil: overall < 0.1 ? 0.6 : 0,
    viseme_PP: PP,
    viseme_FF: FF,
    viseme_TH: TH,
    viseme_DD: (E + I) * 0.35,
    viseme_kk: (aa + O) * 0.3,
    viseme_CH: SS * 0.6,
    viseme_SS: SS,
    viseme_nn: (E + aa) * 0.25,
    viseme_RR: O * 0.35,
    viseme_aa: aa,
    viseme_E: E,
    viseme_I: I,
    viseme_O: O,
    viseme_U: U,
    jawOpen,
  };
}
