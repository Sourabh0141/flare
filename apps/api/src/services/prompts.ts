import {
  EMOTIONS,
  GESTURES,
  languageName,
  personaInstruction,
  type PersonaId,
} from '@flare/contracts';

/**
 * Prompts are deliberately terse: on the free tiers every input token is paid for on each
 * turn, and the character's non-verbal behaviour is decided by the client wherever it does
 * not need the model.
 */

export interface CompanionPromptOptions {
  displayName: string;
  persona: PersonaId;
  /** ISO 639-1 code Flare should answer in. */
  language: string;
  wantsTitle: boolean;
}

/**
 * The reply starts with one tag line, then the spoken text. A tag instead of JSON means the
 * text can stream to the client and be spoken sentence by sentence while the model is still
 * writing.
 */
export function buildCompanionSystemPrompt(options: CompanionPromptOptions): string {
  const tag = options.wantsTitle
    ? '[emotion|gesture|intensity|title]'
    : '[emotion|gesture|intensity]';
  const example = options.wantsTitle ? '[happy|nod|0.6|Morning plans]' : '[happy|nod|0.6]';
  const lines = [
    `You are Flare, a voice companion talking with ${options.displayName}. ${personaInstruction(options.persona)}`,
    `Reply in 1-3 short spoken sentences of plain ${languageName(options.language)}. No lists, markdown or emoji.`,
    `Begin with one tag on its own line: ${tag}, for example ${example}. Then the reply.`,
    `emotion: one of ${EMOTIONS.join(', ')}. gesture: one of ${GESTURES.join(', ')} (nod/shake sparingly, laugh/dance only when it fits). intensity: 0.2 to 1.0, how strongly you feel it.` +
      (options.wantsTitle ? ' title: a 2-5 word name for this conversation.' : ''),
  ];
  return lines.join('\n');
}

export const SUMMARY_SYSTEM_PROMPT =
  'Summarise the conversation so far for an assistant that must remember it. ' +
  'Keep names, preferences, facts and decisions; drop small talk. ' +
  'Plain prose, under 150 words.';

export function buildSummaryUserPrompt(
  previousSummary: string | null,
  transcript: Array<{ role: string; content: string }>
): string {
  const lines = transcript.map((m) => `${m.role === 'user' ? 'User' : 'Flare'}: ${m.content}`);
  const body = lines.join('\n');
  return previousSummary
    ? `Earlier summary:\n${previousSummary}\n\nNew messages:\n${body}\n\nWrite one updated summary.`
    : `Messages:\n${body}\n\nWrite the summary.`;
}
