import {
  DEFAULT_EMOTION,
  DEFAULT_GESTURE,
  LIMITS,
  isEmotion,
  isGesture,
  type Expression,
  type PersonaId,
} from '@flare/contracts';
import type { ConversationContext } from '@flare/db';
import type { Logger } from '../lib/logger';
import type { ChatMessage, DeepInfraClient } from './deepinfra';
import { buildCompanionSystemPrompt } from './prompts';

export const DEFAULT_EXPRESSION: Expression = {
  emotion: DEFAULT_EMOTION,
  gesture: DEFAULT_GESTURE,
  intensity: 0.5,
};

export interface ReplyHeader {
  expression: Expression;
  title: string | null;
}

export interface StreamReplyInput {
  model: string;
  displayName: string;
  persona: PersonaId;
  language: string;
  context: ConversationContext;
  transcript: string;
  /** Ask the model to name the conversation in the same call (first turn only). */
  wantsTitle: boolean;
  logger: Logger;
  signal?: AbortSignal;
}

export interface StreamReplyHandlers {
  /** The tag line has been parsed (or given up on); fires once, before any text. */
  onHeader: (header: ReplyHeader) => void | Promise<void>;
  onDelta: (text: string) => void | Promise<void>;
  onSentence: (index: number, text: string) => void | Promise<void>;
}

export interface StreamReplyResult {
  reply: string;
  header: ReplyHeader;
  sentences: string[];
}

/**
 * Streams the model's reply. The first line is a tag with the expression (and title on a
 * new thread); everything after it is spoken text, which is split into sentences as it
 * arrives so speech synthesis can start on the first one immediately.
 */
export async function streamReply(
  client: DeepInfraClient,
  input: StreamReplyInput,
  handlers: StreamReplyHandlers
): Promise<StreamReplyResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildCompanionSystemPrompt({
        displayName: input.displayName,
        persona: input.persona,
        language: input.language,
        wantsTitle: input.wantsTitle,
      }),
    },
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

  const headerParser = new HeaderParser();
  const splitter = new SentenceSplitter();
  const sentences: string[] = [];
  let header: ReplyHeader | null = null;
  let reply = '';

  const emitSentences = async (chunks: string[]) => {
    for (const sentence of chunks) {
      const index = sentences.length;
      sentences.push(sentence);
      await handlers.onSentence(index, sentence);
    }
  };

  const stream = client.chatStream({
    model: input.model,
    messages,
    temperature: 0.7,
    maxTokens: 240,
    ...(input.signal ? { signal: input.signal } : {}),
  });

  for await (const delta of stream) {
    let text = delta;
    if (!header) {
      const outcome = headerParser.feed(delta);
      if (!outcome) continue; // still buffering the tag line
      header = outcome.header;
      text = outcome.rest;
      await handlers.onHeader(header);
      if (!text) continue;
    }
    reply += text;
    await handlers.onDelta(text);
    await emitSentences(splitter.push(text));
  }

  if (!header) {
    // The model never produced a tag; treat everything buffered as the reply.
    const rest = headerParser.drain();
    header = { expression: DEFAULT_EXPRESSION, title: null };
    await handlers.onHeader(header);
    if (rest) {
      reply += rest;
      await handlers.onDelta(rest);
      await emitSentences(splitter.push(rest));
    }
  }
  await emitSentences(splitter.flush());

  const cleaned = sanitiseSpeech(reply);
  input.logger.info('llm.completed', { characters: cleaned.length, sentences: sentences.length });
  return { reply: cleaned, header, sentences };
}

// -----------------------------------------------------------------------------
// Tag line parsing: "[emotion|gesture|intensity]" or "[emotion|gesture|intensity|title]"
// -----------------------------------------------------------------------------

const HEADER_PATTERN = /^\s*\[([^\]\n]{0,160})\]\s*\n?/;
/** Give up waiting for a tag once this much text has arrived without one. */
const HEADER_BUFFER_LIMIT = 200;

export function parseHeaderFields(inner: string): ReplyHeader {
  const parts = inner.split('|').map((p) => p.trim());
  const emotion = isEmotion(parts[0]?.toLowerCase())
    ? (parts[0]!.toLowerCase() as Expression['emotion'])
    : DEFAULT_EMOTION;
  const gesture = isGesture(parts[1]?.toLowerCase())
    ? (parts[1]!.toLowerCase() as Expression['gesture'])
    : DEFAULT_GESTURE;
  const parsedIntensity = Number.parseFloat(parts[2] ?? '');
  const intensity = Number.isFinite(parsedIntensity)
    ? Math.min(1, Math.max(0, parsedIntensity))
    : DEFAULT_EXPRESSION.intensity;
  const title = parts.length > 3 ? sanitiseTitle(parts.slice(3).join('|')) : null;
  return { expression: { emotion, gesture, intensity }, title };
}

/** Buffers the start of the stream until the tag line is complete or clearly absent. */
export class HeaderParser {
  private buffer = '';

  feed(delta: string): { header: ReplyHeader; rest: string } | null {
    this.buffer += delta;
    const trimmed = this.buffer.trimStart();

    const match = HEADER_PATTERN.exec(this.buffer);
    if (match) {
      const rest = this.buffer.slice(match[0].length);
      this.buffer = '';
      return { header: parseHeaderFields(match[1] ?? ''), rest };
    }

    const startsLikeTag = trimmed.length === 0 || trimmed.startsWith('[');
    const tooLong = this.buffer.length > HEADER_BUFFER_LIMIT;
    if (!startsLikeTag || tooLong) {
      const rest = this.buffer;
      this.buffer = '';
      return { header: { expression: DEFAULT_EXPRESSION, title: null }, rest };
    }
    return null;
  }

  drain(): string {
    const rest = this.buffer;
    this.buffer = '';
    return rest;
  }
}

// -----------------------------------------------------------------------------
// Sentence splitting on a stream of text fragments
// -----------------------------------------------------------------------------

/** Latin terminators need trailing whitespace (so "3.50" survives); CJK stops do not. */
const SENTENCE_END = /(?:[.!?…]+["')\]]*(?:\s+|$)|[。！？])/g;
/** Fragments shorter than this are merged into the next sentence ("Oh." + "Really?"). */
const MIN_SENTENCE_CHARS = 5;

export class SentenceSplitter {
  private pending = '';

  /** Feeds text and returns any sentences completed by it. */
  push(text: string): string[] {
    this.pending += text;
    const out: string[] = [];
    let carry = '';

    for (;;) {
      SENTENCE_END.lastIndex = 0;
      const match = SENTENCE_END.exec(this.pending);
      if (!match) break;
      const end = match.index + match[0].length;
      const candidate = (carry + this.pending.slice(0, end)).trim();
      this.pending = this.pending.slice(end);
      if (candidate.length < MIN_SENTENCE_CHARS) {
        carry = candidate + ' ';
        continue;
      }
      out.push(candidate);
      carry = '';
    }
    if (carry) this.pending = carry + this.pending;
    return out;
  }

  /** Returns whatever is left at the end of the stream. */
  flush(): string[] {
    const rest = this.pending.trim();
    this.pending = '';
    return rest ? [rest] : [];
  }
}

// -----------------------------------------------------------------------------
// Text hygiene
// -----------------------------------------------------------------------------

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
    .replace(/["'*_`#[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, LIMITS.conversationTitleMax);
}
