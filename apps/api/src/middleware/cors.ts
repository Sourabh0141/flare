import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import { parseAllowedOrigins } from '../config/env.js';
import type { AppEnv } from '../types.js';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Compiles the allowlist once. Entries may contain a single `*` wildcard in the host, for
 * example `https://*.flare-web.pages.dev`, which matches Pages preview deployments.
 */
export function createOriginMatcher(allowed: string[]): (origin: string) => boolean {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];

  for (const entry of allowed) {
    if (entry.includes('*')) {
      const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+');
      patterns.push(new RegExp(`^${escaped}$`, 'i'));
    } else {
      exact.add(entry.toLowerCase());
    }
  }

  return (origin: string) => {
    const lower = origin.toLowerCase();
    return exact.has(lower) || patterns.some((p) => p.test(lower));
  };
}

/**
 * CORS restricted to configured origins. `ALLOWED_ORIGINS` is read straight from the
 * environment here (rather than the validated config) so preflight requests keep working
 * even when other configuration is broken.
 */
export const corsMiddleware: MiddlewareHandler<AppEnv> = (c, next) => {
  const matcher = createOriginMatcher(parseAllowedOrigins(c.env.ALLOWED_ORIGINS));
  const handler = cors({
    origin: (origin) => (matcher(origin) || LOCAL_DEV_ORIGIN.test(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id', 'Content-Length', 'Content-Type'],
    maxAge: 86_400,
  });
  return handler(c, next);
};
