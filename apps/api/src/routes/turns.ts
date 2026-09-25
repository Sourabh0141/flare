import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  ACCEPTED_AUDIO_TYPES,
  LIMITS,
  respondRequestSchema,
  speakableLanguage,
  voiceForLanguage,
  type TranscribeResponse,
  type TurnEvent,
} from '@flare/contracts';
import {
  countUserTurnsSince,
  createConversation,
  getConversation,
  getConversationContext,
  getOrCreateUser,
  insertMessage,
  isConversationStale,
  nowSeconds,
  setGeneratedTitle,
} from '@flare/db';
import { ApiError } from '../lib/errors';
import { rateLimitBy } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { DeepInfraClient } from '../services/deepinfra';
import { sanitiseSpeech, streamReply } from '../services/responder';
import { maybeSummarize } from '../services/summarizer';
import type { AppEnv } from '../types';

/** A conversation idle for longer than this starts a fresh thread on the next turn. */
export const CONVERSATION_STALE_SECONDS = 30 * 60;

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

/** Start of the current UTC day in epoch seconds. */
export function startOfUtcDay(now: number = nowSeconds()): number {
  return now - (now % 86_400);
}

export const turnsRoutes = new Hono<AppEnv>();

turnsRoutes.use(
  '*',
  rateLimitBy((env) => env.TURN_RATE_LIMITER, 'turn')
);

/**
 * POST /api/turns/transcribe
 * Body: raw audio bytes with the recording's Content-Type. Returns the transcript.
 * A raw body (rather than multipart) means the Worker never parses the upload itself.
 */
turnsRoutes.post('/transcribe', async (c) => {
  const contentType =
    (c.req.header('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(ACCEPTED_AUDIO_TYPES as readonly string[]).includes(contentType)) {
    throw new ApiError('unsupported_media_type', 'Send the recording as a raw audio body.', {
      details: { accepted: ACCEPTED_AUDIO_TYPES },
    });
  }

  const declaredLength = Number(c.req.header('content-length') ?? 0);
  if (declaredLength > LIMITS.audioUploadMaxBytes) {
    throw new ApiError('payload_too_large', 'That recording is too large to transcribe.');
  }

  const audio = await c.req.blob();
  if (audio.size === 0) {
    throw new ApiError('bad_request', 'The recording is empty.');
  }
  if (audio.size > LIMITS.audioUploadMaxBytes) {
    throw new ApiError('payload_too_large', 'That recording is too large to transcribe.');
  }

  const { deepinfra } = c.get('config');
  const client = new DeepInfraClient({ apiKey: deepinfra.apiKey });
  const startedAt = Date.now();
  const result = await client.transcribe({
    model: deepinfra.sttModel,
    audio: new Blob([audio], { type: contentType }),
    filename: `utterance.${AUDIO_EXTENSIONS[contentType] ?? 'bin'}`,
  });

  c.get('logger').info('stt.completed', {
    bytes: audio.size,
    durationMs: Date.now() - startedAt,
    characters: result.text.length,
    language: result.language,
  });

  if (!result.text) {
    throw new ApiError('no_speech_detected', "I couldn't hear anything in that recording.");
  }

  const body: TranscribeResponse = {
    transcript: result.text.slice(0, LIMITS.transcriptMax),
    language: result.language,
  };
  return c.json(body);
});

/**
 * POST /api/turns/respond
 * Persists the user's transcript, streams the model's reply as server-sent events, and
 * synthesises each sentence as soon as it is complete so the first audio arrives while the
 * model is still writing. Summarisation of long conversations runs after the stream ends.
 */
turnsRoutes.post('/respond', validate('json', respondRequestSchema), async (c) => {
  const userId = c.get('userId');
  const logger = c.get('logger');
  const { deepinfra, dailyTurnLimit } = c.get('config');
  const { conversationId, transcript, language: spokenLanguage } = c.req.valid('json');
  const db = c.env.DB;

  const user = await getOrCreateUser(db, userId);

  // Daily cap: a spending guard for the provider bill, checked before any model call.
  const turnsToday = await countUserTurnsSince(db, userId, startOfUtcDay());
  if (turnsToday >= dailyTurnLimit) {
    throw new ApiError(
      'quota_exceeded',
      "You've reached today's limit of turns. Flare will be ready again tomorrow.",
      { details: { limit: dailyTurnLimit } }
    );
  }

  // Resolve the thread: continue it when it exists, is owned, and is still warm.
  let conversation = conversationId ? await getConversation(db, conversationId, userId) : null;
  let isNewConversation = false;
  if (!conversation || isConversationStale(conversation, CONVERSATION_STALE_SECONDS)) {
    conversation = await createConversation(db, userId);
    isNewConversation = true;
  }

  const context = await getConversationContext(db, conversation.id);
  const wantsTitle = isNewConversation || context.messages.length === 0;
  const language = speakableLanguage(spokenLanguage);
  const voice = voiceForLanguage(language, user.voice);

  const turnAt = nowSeconds();
  const userMessage = await insertMessage(db, {
    conversationId: conversation.id,
    role: 'user',
    content: transcript,
    language,
    createdAt: turnAt,
  });

  const client = new DeepInfraClient({ apiKey: deepinfra.apiKey });
  const executionCtx = c.executionCtx;
  const activeConversation = conversation;

  return streamSSE(c, async (stream) => {
    const send = (event: TurnEvent) =>
      stream.writeSSE({ event: 'turn', data: JSON.stringify(event) });

    await send({
      type: 'meta',
      conversation: activeConversation,
      isNewConversation,
      userMessage,
      turnsRemainingToday: Math.max(0, dailyTurnLimit - turnsToday - 1),
      language,
    });

    // Sentence audio is synthesised as each sentence completes and delivered in order.
    let audioChain: Promise<void> = Promise.resolve();
    const speakSentence = (index: number, text: string) => {
      const synthesis = client.speakToBuffer({
        model: deepinfra.ttsModel,
        voice,
        text: sanitiseSpeech(text),
        signal: c.req.raw.signal,
      });
      audioChain = audioChain.then(async () => {
        try {
          const { bytes, contentType } = await synthesis;
          await send({
            type: 'audio',
            index,
            mimeType: contentType,
            data: Buffer.from(bytes).toString('base64'),
          });
        } catch (error) {
          logger.warn('tts.sentence_failed', { index, error });
        }
      });
    };

    try {
      const result = await streamReply(
        client,
        {
          model: deepinfra.llmModel,
          displayName: user.displayName,
          persona: user.persona,
          language,
          context,
          transcript,
          wantsTitle,
          logger,
          signal: c.req.raw.signal,
        },
        {
          onHeader: (header) => send({ type: 'expression', expression: header.expression }),
          onDelta: (text) => send({ type: 'delta', text }),
          onSentence: async (index, text) => {
            await send({ type: 'sentence', index, text });
            speakSentence(index, text);
          },
        }
      );

      await audioChain;

      const assistantMessage = await insertMessage(db, {
        conversationId: activeConversation.id,
        role: 'assistant',
        content: result.reply,
        emotion: result.header.expression.emotion,
        gesture: result.header.expression.gesture,
        intensity: result.header.expression.intensity,
        language,
        createdAt: turnAt + 1,
      });

      let finalConversation = { ...activeConversation, updatedAt: assistantMessage.createdAt };
      if (wantsTitle && result.header.title) {
        await setGeneratedTitle(db, activeConversation.id, userId, result.header.title);
        finalConversation = { ...finalConversation, title: result.header.title };
      }

      executionCtx.waitUntil(
        maybeSummarize(client, {
          db,
          conversationId: activeConversation.id,
          model: deepinfra.llmModel,
          logger,
        }).catch((error: unknown) => logger.error('summary.failed', { error }))
      );

      await send({ type: 'done', assistantMessage, conversation: finalConversation });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError('internal_error', 'Something went wrong while replying.', {
              cause: error,
            });
      logger.error('turn.failed', { code: apiError.code, error: apiError });
      await send({ type: 'error', code: apiError.code, message: apiError.message });
    }
  });
});
