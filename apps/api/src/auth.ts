import type { MiddlewareHandler } from 'hono';
import { verifyToken } from '@clerk/backend';
import type { AppEnv } from './types.js';

/**
 * Middleware that authenticates requests using Clerk JWT tokens from the Authorization header.
 * Rejects unauthenticated requests with a 401 Unauthorized status.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Allow preflight OPTIONS requests through without authentication
  if (c.req.method === 'OPTIONS') {
    return await next();
  }

  const authHeader = c.req.header('Authorization') || c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected Bearer <token>.',
      },
      401
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Empty token provided in Authorization header.',
      },
      401
    );
  }

  const secretKey = c.env.CLERK_SECRET_KEY;
  const jwtKey = c.env.CLERK_JWT_KEY;

  if (!secretKey && !jwtKey) {
    console.error('CLERK_SECRET_KEY or CLERK_JWT_KEY is not configured in Worker environment.');
    return c.json(
      {
        error: 'InternalServerError',
        message: 'Authentication provider is not properly configured.',
      },
      500
    );
  }

  try {
    const verified = await verifyToken(token, {
      secretKey,
      jwtKey,
    });

    if (!verified || !verified.sub) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid session token: missing subject identifier.',
        },
        401
      );
    }

    // Set authenticated user context
    c.set('userId', verified.sub);
    c.set('claims', verified as unknown as Record<string, unknown>);

    await next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    return c.json(
      {
        error: 'Unauthorized',
        message: `Invalid or expired session token: ${message}`,
      },
      401
    );
  }
};
