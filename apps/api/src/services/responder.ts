import {
  DEFAULT_EMOTION,
  DEFAULT_GESTURE,
  LIMITS,
  isEmotion,
  isGesture,
  type Emotion,
  type Gesture,
} from '@flare/contracts';
import type { ConversationContext } from '@flare/db';
import type { Logger } from '../lib/logger.js';
import type { ChatMessage, DeepInfraClient } from './deepinfra.js';
import { buildCompanionSystemPrompt } from './prompts.js';

export interface AssistantTurn {
  reply: string;
  emotion: Emotion;
  gesture: Gesture;
  title: string | null;
}

export interface GenerateReplyInput {
  model: string;
  displayName: string;
  context: ConversationContext;
  transcript: string;
  /** Ask the model to name the conversation in the same call (first turn only). */
  wantsTitle: boolean;
  logger: Logger;
}

/**
 * One LLM call produces the spoken reply plus the character's emotion and gesture, and on
 * the first turn a conversation title. JSON mode guarantees a parseable object; the
 * enums are still validated because the model may improvise a value.
 */
export async function generateReply(
  client: DeepInfraClient,
  input: GenerateReplyInput
): Promise<AssistantTurn> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildCompanionSystemPrompt(input.displayName, input.wantsTitle) },
  ];

  if (input.context.summary) {
    messages.push({
      role: 'system',
      content: `Earlier in this conversation: ${input.context.summary.content}`,
    });
  }

  for (const message of input.context.messages) {
    if (message.role === 'user' || message.role === 'assistant') {
      messages.push({ role: message.role, content: message.content });
    }
  }
  messages.push({ role: 'user', content: input.transcript });

  const result = await client.chat({
    model: input.model,
    messages,
    temperature: 0.7,
    maxTokens: 220,
    jsonMode: true,
  });

  input.logger.info('llm.completed', { usage: result.usage });
  return parseAssistantTurn(result.content, input.logger);
}

/** Parses the model output defensively; a malformed payload still yields a usable reply. */
export function parseAssistantTurn(raw: string, logger?: Logger): AssistantTurn {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    logger?.warn('llm.unparseable', { sample: raw.slice(0, 120) });
    return {
      reply: sanitiseSpeech(raw),
      emotion: DEFAULT_EMOTION,
      gesture: DEFAULT_GESTURE,
      title: null,
    };
  }

  const record =
    typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const reply = sanitiseSpeech(typeof record.reply === 'string' ? record.reply : raw);
  const emotion = isEmotion(record.emotion) ? record.emotion : DEFAULT_EMOTION;
  const gesture = isGesture(record.gesture) ? record.gesture : DEFAULT_GESTURE;
  const title = typeof record.title === 'string' ? sanitiseTitle(record.title) : null;

  return { reply, emotion, gesture, title };
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Strips anything a text-to-speech engine would read out awkwardly. */
export function sanitiseSpeech(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0
    ? cleaned.slice(0, LIMITS.transcriptMax)
    : 'Sorry, I lost my train of thought. Could you say that again?';
}

export function sanitiseTitle(text: string): string | null {
  const cleaned = text
    .replace(/["'*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, LIMITS.conversationTitleMax);
}
