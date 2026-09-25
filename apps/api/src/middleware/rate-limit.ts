import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../lib/errors';
import type { AppEnv } from '../types';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Per-user rate limiting on top of a Workers Rate Limiting binding. Runs after auth so the
 * key is the user id, not the IP. Degrades to "allow" when the binding is absent (local
 * development and unit tests) rather than taking the API down.
 */
export function rateLimitBy(
  select: (env: AppEnv['Bindings']) => RateLimiter | undefined,
  scope: string
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = select(c.env);
    if (!limiter) {
      await next();
      return;
    }

    const key = `${scope}:${c.get('userId')}`;
    const { success } = await limiter.limit({ key });
    if (!success) {
      c.get('logger').warn('rate_limit.exceeded', { scope });
      c.header('Retry-After', '60');
      throw new ApiError(
        'rate_limited',
        'You are sending requests too quickly. Try again in a minute.'
      );
    }
    await next();
  };
}
