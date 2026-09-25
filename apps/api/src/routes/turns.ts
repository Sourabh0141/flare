import { Hono } from 'hono';
import {
  ACCEPTED_AUDIO_TYPES,
  LIMITS,
  respondRequestSchema,
  type RespondResponse,
  type TranscribeResponse,
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
import { generateReply } from '../services/responder';
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
 * Persists the user's transcript, asks the model for a reply with emotion and gesture, and
 * persists that too. Summarisation of long conversations runs after the response is sent.
 */
turnsRoutes.post('/respond', validate('json', respondRequestSchema), async (c) => {
  const userId = c.get('userId');
  const logger = c.get('logger');
  const { deepinfra, dailyTurnLimit } = c.get('config');
  const { conversationId, transcript } = c.req.valid('json');
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

  const turnAt = nowSeconds();
  const userMessage = await insertMessage(db, {
    conversationId: conversation.id,
    role: 'user',
    content: transcript,
    createdAt: turnAt,
  });

  const client = new DeepInfraClient({ apiKey: deepinfra.apiKey });
  const turn = await generateReply(client, {
    model: deepinfra.llmModel,
    displayName: user.displayName,
    persona: user.persona,
    context,
    transcript,
    wantsTitle,
    logger,
  });

  const assistantMessage = await insertMessage(db, {
    conversationId: conversation.id,
    role: 'assistant',
    content: turn.reply,
    emotion: turn.emotion,
    gesture: turn.gesture,
    createdAt: turnAt + 1,
  });

  if (wantsTitle && turn.title) {
    await setGeneratedTitle(db, conversation.id, userId, turn.title);
    conversation = { ...conversation, title: turn.title };
  }

  c.executionCtx.waitUntil(
    maybeSummarize(client, {
      db,
      conversationId: conversation.id,
      model: deepinfra.llmModel,
      logger,
    }).catch((error: unknown) => logger.error('summary.failed', { error }))
  );

  const body: RespondResponse = {
    conversation: { ...conversation, updatedAt: assistantMessage.createdAt },
    isNewConversation,
    userMessage,
    assistantMessage,
    turnsRemainingToday: Math.max(0, dailyTurnLimit - turnsToday - 1),
  };
  return c.json(body);
});
