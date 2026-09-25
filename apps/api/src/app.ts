import { Hono } from 'hono';
import { requireAuth } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { onError, onNotFound } from './middleware/error-handler.js';
import { rateLimitBy } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { conversationsRoutes } from './routes/conversations.js';
import { healthRoutes } from './routes/health.js';
import { messagesRoutes } from './routes/messages.js';
import { settingsRoutes } from './routes/settings.js';
import { turnsRoutes } from './routes/turns.js';
import type { AppEnv } from './types.js';

/**
 * Assembles the API. Middleware order matters: CORS answers preflights before anything can
 * fail, the request context attaches ids and config, then auth and rate limiting guard the
 * protected surface.
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.onError(onError);
  app.notFound(onNotFound);

  app.use('*', corsMiddleware);
  app.use('*', requestContext);

  // Public
  app.route('/', healthRoutes);
  app.route('/api/health', healthRoutes);

  // Protected
  const api = new Hono<AppEnv>();
  api.use('*', requireAuth);
  api.use(
    '*',
    rateLimitBy((env) => env.API_RATE_LIMITER, 'api')
  );
  api.route('/settings', settingsRoutes);
  api.route('/conversations', conversationsRoutes);
  api.route('/turns', turnsRoutes);
  api.route('/messages', messagesRoutes);
  app.route('/api', api);

  return app;
}

export type App = ReturnType<typeof createApp>;
