import { Hono } from 'hono';
import { updateSettingsRequestSchema, type SettingsResponse } from '@flare/contracts';
import { getOrCreateUser, setUserDisplayName } from '@flare/db';
import { validate } from '../middleware/validate.js';
import type { AppEnv } from '../types.js';

export const settingsRoutes = new Hono<AppEnv>();

/** GET /api/settings: the caller's profile, created on first contact. */
settingsRoutes.get('/', async (c) => {
  const user = await getOrCreateUser(c.env.DB, c.get('userId'));
  const body: SettingsResponse = { user };
  return c.json(body);
});

/** PATCH /api/settings: update the display name the companion uses. */
settingsRoutes.patch('/', validate('json', updateSettingsRequestSchema), async (c) => {
  const { displayName } = c.req.valid('json');
  const user = await setUserDisplayName(c.env.DB, c.get('userId'), displayName);
  const body: SettingsResponse = { user };
  return c.json(body);
});
