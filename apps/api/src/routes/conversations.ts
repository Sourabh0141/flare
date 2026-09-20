import { Hono } from 'hono';
import {
  listConversations,
  getConversation,
  getConversationMessages,
  updateConversationTitle,
  deleteConversation,
} from '@flare/db';
import type { AppEnv, UpdateConversationRequest } from '../types.js';

export const conversationsRoutes = new Hono<AppEnv>();

/**
 * GET /api/conversations - List all conversations for the authenticated user (for sidebar).
 */
conversationsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const limitQuery = c.req.query('limit');
  const limit = limitQuery ? Math.min(Math.max(parseInt(limitQuery, 10) || 50, 1), 100) : 50;

  const conversations = await listConversations(c.env.DB, userId, limit);

  return c.json({
    conversations,
  });
});

/**
 * GET /api/conversations/:id - Retrieve a specific conversation and its messages.
 */
conversationsRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');

  const conversation = await getConversation(c.env.DB, conversationId, userId);
  if (!conversation) {
    return c.json(
      {
        error: 'NotFound',
        message: 'Conversation not found.',
      },
      404
    );
  }

  const messages = await getConversationMessages(c.env.DB, conversationId);

  return c.json({
    conversation,
    messages,
  });
});

/**
 * PATCH /api/conversations/:id - Rename a conversation title.
 */
conversationsRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');

  let body: UpdateConversationRequest;
  try {
    body = await c.req.json<UpdateConversationRequest>();
  } catch {
    return c.json(
      {
        error: 'BadRequest',
        message: 'Invalid JSON request payload.',
      },
      400
    );
  }

  if (!body || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return c.json(
      {
        error: 'BadRequest',
        message: 'title must be a non-empty string.',
      },
      400
    );
  }

  const trimmedTitle = body.title.trim();
  if (trimmedTitle.length > 100) {
    return c.json(
      {
        error: 'BadRequest',
        message: 'title cannot exceed 100 characters.',
      },
      400
    );
  }

  const success = await updateConversationTitle(c.env.DB, conversationId, userId, trimmedTitle);
  if (!success) {
    return c.json(
      {
        error: 'NotFound',
        message: 'Conversation not found or access denied.',
      },
      404
    );
  }

  const updatedConversation = await getConversation(c.env.DB, conversationId, userId);

  return c.json({
    success: true,
    conversation: updatedConversation,
  });
});

/**
 * DELETE /api/conversations/:id - Delete a conversation and its messages.
 */
conversationsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');

  const success = await deleteConversation(c.env.DB, conversationId, userId);
  if (!success) {
    return c.json(
      {
        error: 'NotFound',
        message: 'Conversation not found or access denied.',
      },
      404
    );
  }

  return c.json({
    success: true,
  });
});
