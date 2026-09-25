import { Hono } from 'hono';
import { inviteRequestSchema, type InviteResponse } from '@flare/contracts';
import { countRecentInviteRequests, insertInviteRequest } from '@flare/db';
import { ApiError } from '../lib/errors';
import { validate } from '../middleware/validate';
import { verifyTurnstile } from '../services/turnstile';
import type { AppEnv } from '../types';

/** Repeat submissions from one address within this window are dropped silently. */
const REPEAT_WINDOW_SECONDS = 24 * 60 * 60;
const REPEAT_LIMIT = 3;

export const invitesRoutes = new Hono<AppEnv>();

/**
 * POST /api/invites (public)
 * Records a request for an invitation. Defences, cheapest first: a honeypot field, an
 * IP-keyed rate limit, Cloudflare Turnstile when configured, and a per-email cap.
 * Bots are told "received" so they learn nothing.
 */
invitesRoutes.post('/', validate('json', inviteRequestSchema), async (c) => {
  const input = c.req.valid('json');
  const logger = c.get('logger');
  const received: InviteResponse = { received: true };

  if (input.website) {
    logger.warn('invite.honeypot');
    return c.json(received, 202);
  }

  const ip = c.req.header('cf-connecting-ip') ?? null;
  const limiter = c.env.PUBLIC_RATE_LIMITER;
  if (limiter && ip) {
    const { success } = await limiter.limit({ key: `invite:${ip}` });
    if (!success) {
      c.header('Retry-After', '60');
      throw new ApiError(
        'rate_limited',
        'Too many requests from this network. Try again in a minute.'
      );
    }
  }

  const { turnstileSecretKey } = c.get('config');
  if (turnstileSecretKey) {
    if (!input.turnstileToken) {
      throw new ApiError('validation_failed', 'Complete the verification challenge and try again.');
    }
    const verification = await verifyTurnstile(turnstileSecretKey, input.turnstileToken, ip);
    if (!verification.success) {
      logger.warn('invite.turnstile_failed', { reason: verification.reason });
      throw new ApiError(
        'validation_failed',
        'Verification failed. Reload the page and try again.'
      );
    }
  }

  const recent = await countRecentInviteRequests(c.env.DB, input.email, REPEAT_WINDOW_SECONDS);
  if (recent >= REPEAT_LIMIT) {
    logger.info('invite.duplicate', { email: input.email });
    return c.json(received, 202);
  }

  const ipHash = ip ? await sha256Hex(ip) : null;
  const userAgent = c.req.header('user-agent')?.slice(0, 300) ?? null;
  const record = await insertInviteRequest(c.env.DB, {
    name: input.name,
    email: input.email,
    reason: input.reason,
    ipHash,
    userAgent,
  });

  logger.info('invite.received', { id: record.id });
  return c.json(received, 202);
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
