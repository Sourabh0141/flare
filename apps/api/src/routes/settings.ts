import { Hono } from 'hono';
import { updateSettingsRequestSchema, type SettingsResponse } from '@flare/contracts';
import { deleteUser, getOrCreateUser, updateUserPreferences } from '@flare/db';
import { validate } from '../middleware/validate';
import type { AppEnv } from '../types';

export const settingsRoutes = new Hono<AppEnv>();

/** GET /api/settings: the caller's profile, created on first contact. */
settingsRoutes.get('/', async (c) => {
  const user = await getOrCreateUser(c.env.DB, c.get('userId'));
  const body: SettingsResponse = { user };
  return c.json(body);
});

/** PATCH /api/settings: change any of display name, voice, personality. */
settingsRoutes.patch('/', validate('json', updateSettingsRequestSchema), async (c) => {
  const prefs = c.req.valid('json');
  const user = await updateUserPreferences(c.env.DB, c.get('userId'), {
    ...(prefs.displayName !== undefined ? { displayName: prefs.displayName } : {}),
    ...(prefs.voice !== undefined ? { voice: prefs.voice } : {}),
    ...(prefs.persona !== undefined ? { persona: prefs.persona } : {}),
  });
  const body: SettingsResponse = { user };
  return c.json(body);
});

/**
 * DELETE /api/settings: erase everything Flare holds for this user. Conversations and
 * messages go with the row through foreign keys. The Clerk account itself is untouched;
 * the user manages that from their profile.
 */
settingsRoutes.delete('/', async (c) => {
  const userId = c.get('userId');
  const deleted = await deleteUser(c.env.DB, userId);
  c.get('logger').info('account.erased', { deleted });
  return c.body(null, 204);
});
