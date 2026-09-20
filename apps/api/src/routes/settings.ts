import { Hono } from 'hono';
import { getOrCreateUser, updateUserDisplayName } from '@flare/db';
import type { AppEnv, UpdateSettingsRequest } from '../types.js';

export const settingsRoutes = new Hono<AppEnv>();

/**
 * GET /api/settings - Retrieve the authenticated user's profile and settings.
 */
settingsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const user = await getOrCreateUser(c.env.DB, userId);

  return c.json({
    user,
  });
});

/**
 * PATCH /api/settings - Update the authenticated user's display name.
 */
settingsRoutes.patch('/', async (c) => {
  const userId = c.get('userId');

  let body: UpdateSettingsRequest;
  try {
    body = await c.req.json<UpdateSettingsRequest>();
  } catch {
    return c.json(
      {
        error: 'BadRequest',
        message: 'Invalid JSON request payload.',
      },
      400
    );
  }

  if (!body || typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
    return c.json(
      {
        error: 'BadRequest',
        message: 'displayName must be a non-empty string.',
      },
      400
    );
  }

  const trimmedDisplayName = body.displayName.trim();
  if (trimmedDisplayName.length > 50) {
    return c.json(
      {
        error: 'BadRequest',
        message: 'displayName cannot exceed 50 characters.',
      },
      400
    );
  }

  let updatedUser = await updateUserDisplayName(c.env.DB, userId, trimmedDisplayName);
  if (!updatedUser) {
    // If the user record did not exist yet, create it with the specified display name
    updatedUser = await getOrCreateUser(c.env.DB, userId, trimmedDisplayName);
  }

  return c.json({
    user: updatedUser,
  });
});
