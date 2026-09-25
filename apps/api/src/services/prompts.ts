import { EMOTIONS, GESTURES, personaInstruction, type PersonaId } from '@flare/contracts';

/**
 * Prompts are deliberately terse: on the free tiers every input token is paid for on each
 * turn, and the character's non-verbal behaviour is decided by the client wherever it does
 * not need the model.
 */

export interface CompanionPromptOptions {
  displayName: string;
  persona: PersonaId;
  wantsTitle: boolean;
}

export function buildCompanionSystemPrompt(options: CompanionPromptOptions): string {
  const lines = [
    `You are Flare, a voice companion talking with ${options.displayName}. ${personaInstruction(options.persona)}`,
    'Reply in 1-3 short spoken sentences of plain English. No lists, markdown or emoji.',
    'Return JSON only: {"reply": string, "emotion": string, "gesture": string' +
      (options.wantsTitle ? ', "title": string' : '') +
      '}.',
    `emotion is one of: ${EMOTIONS.join(', ')}.`,
    `gesture is one of: ${GESTURES.join(', ')} (use nod/shake sparingly, laugh/dance only when it fits).`,
  ];
  if (options.wantsTitle) {
    lines.push('title is a 2-5 word name for this conversation.');
  }
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
