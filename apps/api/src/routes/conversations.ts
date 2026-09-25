import { Hono } from 'hono';
import {
  listConversationsQuerySchema,
  updateConversationRequestSchema,
  type ConversationDetailResponse,
  type ListConversationsResponse,
  type UpdateConversationResponse,
} from '@flare/contracts';
import {
  deleteConversation,
  getConversation,
  listConversations,
  listMessages,
  updateConversation,
} from '@flare/db';
import { ApiError } from '../lib/errors';
import { validate } from '../middleware/validate';
import type { AppEnv } from '../types';

export const conversationsRoutes = new Hono<AppEnv>();

/** GET /api/conversations?limit&cursor&archived: pinned first, then most recent. */
conversationsRoutes.get('/', validate('query', listConversationsQuerySchema), async (c) => {
  const { limit, cursor, archived } = c.req.valid('query');
  const page = await listConversations(c.env.DB, c.get('userId'), { limit, cursor, archived });
  const body: ListConversationsResponse = page;
  return c.json(body);
});

/** GET /api/conversations/:id: the conversation with its full transcript. */
conversationsRoutes.get('/:id', async (c) => {
  const conversation = await getConversation(c.env.DB, c.req.param('id'), c.get('userId'));
  if (!conversation) {
    throw new ApiError('not_found', 'Conversation not found.');
  }
  const messages = await listMessages(c.env.DB, conversation.id);
  const body: ConversationDetailResponse = { conversation, messages };
  return c.json(body);
});

/** PATCH /api/conversations/:id: rename, pin or archive. */
conversationsRoutes.patch('/:id', validate('json', updateConversationRequestSchema), async (c) => {
  const changes = c.req.valid('json');
  const conversation = await updateConversation(c.env.DB, c.req.param('id'), c.get('userId'), {
    ...(changes.title !== undefined ? { title: changes.title } : {}),
    ...(changes.pinned !== undefined ? { pinned: changes.pinned } : {}),
    ...(changes.archived !== undefined ? { archived: changes.archived } : {}),
  });
  if (!conversation) {
    throw new ApiError('not_found', 'Conversation not found.');
  }
  const body: UpdateConversationResponse = { conversation };
  return c.json(body);
});

/** DELETE /api/conversations/:id: removes the conversation and every message in it. */
conversationsRoutes.delete('/:id', async (c) => {
  const deleted = await deleteConversation(c.env.DB, c.req.param('id'), c.get('userId'));
  if (!deleted) {
    throw new ApiError('not_found', 'Conversation not found.');
  }
  return c.body(null, 204);
});
