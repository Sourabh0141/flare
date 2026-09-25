import { Hono } from 'hono';
import { requireAuth } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import { onError, onNotFound } from './middleware/error-handler';
import { rateLimitBy } from './middleware/rate-limit';
import { requestContext } from './middleware/request-context';
import { adminRoutes } from './routes/admin';
import { conversationsRoutes } from './routes/conversations';
import { healthRoutes } from './routes/health';
import { invitesRoutes } from './routes/invites';
import { messagesRoutes } from './routes/messages';
import { openApiRoutes } from './routes/openapi';
import { settingsRoutes } from './routes/settings';
import { turnsRoutes } from './routes/turns';
import { voicesRoutes } from './routes/voices';
import type { AppEnv } from './types';

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
  app.route('/api', openApiRoutes);
  app.route('/api/invites', invitesRoutes);

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
  api.route('/voices', voicesRoutes);
  api.route('/admin', adminRoutes);
  app.route('/api', api);

  return app;
}

export type App = ReturnType<typeof createApp>;
