import { Hono } from 'hono';
import { SPEECH_CONTENT_TYPE, VOICE_PREVIEW_TEXT, isVoiceId } from '@flare/contracts';
import { ApiError } from '../lib/errors';
import { rateLimitBy } from '../middleware/rate-limit';
import { DeepInfraClient } from '../services/deepinfra';
import type { AppEnv } from '../types';

export const voicesRoutes = new Hono<AppEnv>();

voicesRoutes.use(
  '*',
  rateLimitBy((env) => env.TURN_RATE_LIMITER, 'turn')
);

/**
 * GET /api/voices/:id/preview
 * A fixed sentence in the requested voice so people can choose one in settings. The text
 * is constant, so the endpoint cannot be used as a general text-to-speech service.
 */
voicesRoutes.get('/:id/preview', async (c) => {
  const voice = c.req.param('id');
  if (!isVoiceId(voice)) {
    throw new ApiError('not_found', 'Unknown voice.');
  }

  const { deepinfra } = c.get('config');
  const client = new DeepInfraClient({ apiKey: deepinfra.apiKey });
  const speech = await client.speak({
    model: deepinfra.ttsModel,
    voice,
    text: VOICE_PREVIEW_TEXT,
    signal: c.req.raw.signal,
  });

  return new Response(speech.body, {
    status: 200,
    headers: {
      'Content-Type': speech.contentType || SPEECH_CONTENT_TYPE,
      // Previews never change, so they can be cached for a day.
      'Cache-Control': 'private, max-age=86400',
      'X-Request-Id': c.get('requestId'),
    },
  });
});
