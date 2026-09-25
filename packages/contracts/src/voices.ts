import { z } from 'zod';

/**
 * Kokoro voices offered in settings. Ids are DeepInfra's voice identifiers; the prefix
 * encodes accent and register (a = American, b = British; f = feminine, m = masculine).
 */
export const VOICES = [
  { id: 'af_heart', label: 'Heart', accent: 'American', note: 'Warm and even. The default.' },
  { id: 'af_bella', label: 'Bella', accent: 'American', note: 'Bright, quick, a little playful.' },
  {
    id: 'af_nicole',
    label: 'Nicole',
    accent: 'American',
    note: 'Soft and close, good late at night.',
  },
  { id: 'af_sky', label: 'Sky', accent: 'American', note: 'Clear and youthful.' },
  { id: 'am_michael', label: 'Michael', accent: 'American', note: 'Steady and low.' },
  { id: 'am_adam', label: 'Adam', accent: 'American', note: 'Relaxed, conversational.' },
  { id: 'bf_emma', label: 'Emma', accent: 'British', note: 'Measured and precise.' },
  { id: 'bm_george', label: 'George', accent: 'British', note: 'Deep and unhurried.' },
] as const;

export const VOICE_IDS = VOICES.map((v) => v.id) as unknown as readonly [
  (typeof VOICES)[number]['id'],
  ...(typeof VOICES)[number]['id'][],
];

export const voiceIdSchema = z.enum(VOICE_IDS);
export type VoiceId = z.infer<typeof voiceIdSchema>;
export const DEFAULT_VOICE: VoiceId = 'af_heart';

export function isVoiceId(value: unknown): value is VoiceId {
  return voiceIdSchema.safeParse(value).success;
}

/** Sentence spoken by the voice preview endpoint; fixed so it cannot be abused as free TTS. */
export const VOICE_PREVIEW_TEXT =
  "Hi, I'm Flare. Say anything and I'll answer, with a mood to match.";

// -----------------------------------------------------------------------------
// Languages. Whisper reports an ISO 639-1 code; Kokoro has native voices for these.
// -----------------------------------------------------------------------------

export interface LanguageVoices {
  name: string;
  feminine: string;
  masculine: string;
}

/** Kokoro voices per language other than English, by register. */
export const LANGUAGE_VOICES: Record<string, LanguageVoices> = {
  es: { name: 'Spanish', feminine: 'ef_dora', masculine: 'em_alex' },
  fr: { name: 'French', feminine: 'ff_siwis', masculine: 'ff_siwis' },
  hi: { name: 'Hindi', feminine: 'hf_alpha', masculine: 'hm_omega' },
  it: { name: 'Italian', feminine: 'if_sara', masculine: 'im_nicola' },
  ja: { name: 'Japanese', feminine: 'jf_alpha', masculine: 'jm_kumo' },
  pt: { name: 'Portuguese', feminine: 'pf_dora', masculine: 'pm_alex' },
  zh: { name: 'Chinese', feminine: 'zf_xiaobei', masculine: 'zm_yunxi' },
};

/** Languages Flare can both understand and speak; everything else falls back to English. */
export const SPOKEN_LANGUAGES = ['en', ...Object.keys(LANGUAGE_VOICES)] as const;

export const languageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i)
  .transform((code) => code.split('-')[0] ?? code);

/** Normalises a Whisper language code to one Flare can speak, or `en`. */
export function speakableLanguage(code: string | null | undefined): string {
  const base = (code ?? '').toLowerCase().split('-')[0] ?? '';
  return base in LANGUAGE_VOICES ? base : 'en';
}

export function languageName(code: string): string {
  return LANGUAGE_VOICES[code]?.name ?? 'English';
}

/**
 * Chooses the voice for a reply: the user's own voice for English, otherwise a native voice
 * in the same register (feminine/masculine) as the user's choice.
 */
export function voiceForLanguage(language: string, preferred: VoiceId): string {
  const native = LANGUAGE_VOICES[speakableLanguage(language)];
  if (!native) return preferred;
  return preferred.charAt(1) === 'm' ? native.masculine : native.feminine;
}

// -----------------------------------------------------------------------------
// Personalities. They change one line of the system prompt and are kept short on purpose:
// the prompt is paid for on every turn.
// -----------------------------------------------------------------------------

export const PERSONAS = [
  {
    id: 'warm',
    label: 'Warm',
    description: 'Friendly, encouraging, easy company.',
    instruction: 'You are warm, encouraging and easy to talk to.',
  },
  {
    id: 'witty',
    label: 'Witty',
    description: 'Quick, dry, likes a good line.',
    instruction: 'You are quick and dry, fond of a good line, never cruel.',
  },
  {
    id: 'calm',
    label: 'Calm',
    description: 'Unhurried, grounded, few words.',
    instruction: 'You are calm and grounded; you use few words and never rush.',
  },
  {
    id: 'curious',
    label: 'Curious',
    description: 'Asks questions, follows threads.',
    instruction: 'You are curious; you ask one good follow-up question when it helps.',
  },
] as const;

export const PERSONA_IDS = PERSONAS.map((p) => p.id) as unknown as readonly [
  (typeof PERSONAS)[number]['id'],
  ...(typeof PERSONAS)[number]['id'][],
];

export const personaIdSchema = z.enum(PERSONA_IDS);
export type PersonaId = z.infer<typeof personaIdSchema>;
export const DEFAULT_PERSONA: PersonaId = 'warm';

export function isPersonaId(value: unknown): value is PersonaId {
  return personaIdSchema.safeParse(value).success;
}

export function personaInstruction(id: PersonaId): string {
  return PERSONAS.find((p) => p.id === id)?.instruction ?? PERSONAS[0].instruction;
}
