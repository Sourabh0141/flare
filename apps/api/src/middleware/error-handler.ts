import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ApiError } from '../lib/errors';
import { rootLogger } from '../lib/logger';
import type { AppEnv } from '../types';

function respond(c: Context<AppEnv>, error: ApiError): Response {
  // Context variables may be unset when the failure happened before requestContext ran.
  const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
  return c.json(error.toBody(requestId), error.status as 400);
}

/** Maps every thrown error to the contract's error body; 5xx details never leak. */
export const onError: ErrorHandler<AppEnv> = (err, c) => {
  const logger = c.get('logger') ?? rootLogger;

  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error('request.failed', { code: err.code, error: err, details: err.details });
    } else {
      logger.warn('request.rejected', { code: err.code, message: err.message });
    }
    return respond(c, err);
  }

  if (err instanceof HTTPException) {
    const code =
      err.status === 404 ? 'not_found' : err.status === 401 ? 'unauthorized' : 'bad_request';
    return respond(c, new ApiError(code, err.message || 'Request failed.'));
  }

  logger.error('request.crashed', { error: err });
  return respond(c, new ApiError('internal_error', 'Something went wrong on our side.'));
};

export const onNotFound: NotFoundHandler<AppEnv> = (c) =>
  respond(c, new ApiError('not_found', `No route for ${c.req.method} ${c.req.path}.`));
