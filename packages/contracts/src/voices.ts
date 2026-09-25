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

/**
 * Personalities change one line of the system prompt. They are kept short on purpose: the
 * prompt is paid for on every turn.
 */
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
