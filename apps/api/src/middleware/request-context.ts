import type { MiddlewareHandler } from 'hono';
import { loadConfig } from '../config/env';
import { rootLogger } from '../lib/logger';
import type { AppEnv } from '../types';

/**
 * Assigns a request id, a bound logger and the validated config to the context, and logs one
 * summary line per request with timing and status.
 */
export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = c.req.header('x-request-id')?.slice(0, 64) || crypto.randomUUID();
  const logger = rootLogger.child({
    requestId,
    method: c.req.method,
    path: c.req.path,
    ray: c.req.header('cf-ray'),
  });

  c.set('requestId', requestId);
  c.set('logger', logger);
  c.header('X-Request-Id', requestId);

  const startedAt = Date.now();
  try {
    // Config errors surface as a structured 500 through the error handler.
    c.set('config', loadConfig(c.env));
    await next();
  } finally {
    const status = c.res.status;
    const fields = { status, durationMs: Date.now() - startedAt };
    if (status >= 500) logger.error('request.completed', fields);
    else if (status >= 400) logger.warn('request.completed', fields);
    else logger.info('request.completed', fields);
  }
};
