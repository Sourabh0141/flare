import { Hono } from 'hono';
import {
  listInvitesQuerySchema,
  reviewInviteRequestSchema,
  type AdminStatusResponse,
  type ListInvitesResponse,
  type ReviewInviteResponse,
} from '@flare/contracts';
import {
  countInviteRequestsByStatus,
  getInviteRequest,
  listInviteRequests,
  setInviteRequestStatus,
} from '@flare/db';
import { ApiError } from '../lib/errors';
import { validate } from '../middleware/validate';
import { isAdmin, sendInvitation } from '../services/clerk-admin';
import type { AppEnv } from '../types';

export const adminRoutes = new Hono<AppEnv>();

/** GET /api/admin/status: whether the caller may use the admin surface. Never 403s. */
adminRoutes.get('/status', async (c) => {
  const body: AdminStatusResponse = {
    isAdmin: await isAdmin(
      c.get('claims'),
      c.get('userId'),
      c.get('config').clerk.secretKey,
      c.get('logger')
    ),
  };
  return c.json(body);
});

adminRoutes.use('*', async (c, next) => {
  const allowed = await isAdmin(
    c.get('claims'),
    c.get('userId'),
    c.get('config').clerk.secretKey,
    c.get('logger')
  );
  if (!allowed) {
    throw new ApiError('forbidden', 'This area is for administrators.');
  }
  await next();
});

/** GET /api/admin/invites?status&limit */
adminRoutes.get('/invites', validate('query', listInvitesQuerySchema), async (c) => {
  const { status, limit } = c.req.valid('query');
  const [invites, counts] = await Promise.all([
    listInviteRequests(c.env.DB, status, limit),
    countInviteRequestsByStatus(c.env.DB),
  ]);
  const body: ListInvitesResponse = { invites, counts };
  return c.json(body);
});

/**
 * PATCH /api/admin/invites/:id { status }
 * Approving sends a Clerk invitation when a secret key is configured; the request is marked
 * approved either way so the dashboard and this page agree.
 */
adminRoutes.patch('/invites/:id', validate('json', reviewInviteRequestSchema), async (c) => {
  const { status } = c.req.valid('json');
  const existing = await getInviteRequest(c.env.DB, c.req.param('id'));
  if (!existing) {
    throw new ApiError('not_found', 'Invite request not found.');
  }

  let invitationSent = false;
  if (status === 'approved' && existing.status !== 'approved') {
    const origin = c.get('config').allowedOrigins.find((o) => !o.includes('*')) ?? null;
    invitationSent = await sendInvitation(
      existing.email,
      origin ? `${origin}/sign-up/` : null,
      c.get('config').clerk.secretKey,
      c.get('logger')
    );
  }

  const invite = await setInviteRequestStatus(c.env.DB, existing.id, status);
  if (!invite) {
    throw new ApiError('not_found', 'Invite request not found.');
  }
  c.get('logger').info('invite.reviewed', { id: invite.id, status, invitationSent });
  const body: ReviewInviteResponse = { invite, invitationSent };
  return c.json(body);
});
