import { Hono } from 'hono';
import { SPEECH_CONTENT_TYPE, voiceForLanguage } from '@flare/contracts';
import { getOrCreateUser, getOwnedMessage } from '@flare/db';
import { ApiError } from '../lib/errors';
import { rateLimitBy } from '../middleware/rate-limit';
import { DeepInfraClient } from '../services/deepinfra';
import type { AppEnv } from '../types';

export const messagesRoutes = new Hono<AppEnv>();

messagesRoutes.use(
  '*',
  rateLimitBy((env) => env.TURN_RATE_LIMITER, 'turn')
);

/**
 * GET /api/messages/:id/audio
 * Streams synthesized speech for one of the caller's assistant messages, in the caller's
 * chosen voice or the native voice for the language it was spoken in. Binding speech to a
 * stored message (rather than accepting free text) keeps the endpoint from being used as an
 * open text-to-speech proxy, and lets the client replay past replies.
 */
messagesRoutes.get('/:id/audio', async (c) => {
  const userId = c.get('userId');
  const message = await getOwnedMessage(c.env.DB, c.req.param('id'), userId);
  if (!message || message.role !== 'assistant') {
    throw new ApiError('not_found', 'Message not found.');
  }

  const user = await getOrCreateUser(c.env.DB, userId);
  const voice = voiceForLanguage(message.language ?? 'en', user.voice);
  const { deepinfra } = c.get('config');
  const client = new DeepInfraClient({ apiKey: deepinfra.apiKey });
  const speech = await client.speak({
    model: deepinfra.ttsModel,
    voice,
    text: message.content,
    signal: c.req.raw.signal,
  });

  c.get('logger').info('tts.started', {
    messageId: message.id,
    voice,
    characters: message.content.length,
  });

  return new Response(speech.body, {
    status: 200,
    headers: {
      'Content-Type': speech.contentType || SPEECH_CONTENT_TYPE,
      // Replies are immutable, so the browser may cache the audio for the session.
      'Cache-Control': 'private, max-age=3600',
      'X-Request-Id': c.get('requestId'),
    },
  });
});
