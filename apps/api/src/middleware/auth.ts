import { verifyToken } from '@clerk/backend';
import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../lib/errors';
import type { AppEnv } from '../types';

/**
 * Authenticates with a Clerk session JWT from the Authorization header.
 *
 * Verification is networkless when `CLERK_JWT_KEY` is configured, which matters on the
 * free Workers plan: a JWKS fetch on every cold start is wall-clock the user waits on.
 * When `ALLOWED_ORIGINS` is set it is also used as `authorizedParties`, so a token minted
 * for another Clerk frontend is rejected even if it is otherwise valid.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header) {
    throw new ApiError('unauthorized', 'Sign in to use this endpoint.');
  }

  const [scheme, token] = header.split(' ', 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    throw new ApiError('unauthorized', 'Expected an Authorization: Bearer <token> header.');
  }

  const { clerk, allowedOrigins } = c.get('config');
  const authorizedParties = allowedOrigins.filter((o) => !o.includes('*'));

  let subject: string | undefined;
  try {
    const payload = await verifyToken(token.trim(), {
      ...(clerk.jwtKey ? { jwtKey: clerk.jwtKey } : {}),
      ...(clerk.secretKey ? { secretKey: clerk.secretKey } : {}),
      ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
      clockSkewInMs: 10_000,
    });
    subject = payload.sub;
  } catch (error) {
    c.get('logger').warn('auth.rejected', {
      reason: error instanceof Error ? error.message : error,
    });
    throw new ApiError('unauthorized', 'Your session is invalid or has expired. Sign in again.');
  }

  if (!subject) {
    throw new ApiError('unauthorized', 'The session token has no subject.');
  }

  c.set('userId', subject);
  c.set('logger', c.get('logger').child({ userId: subject }));
  await next();
};
