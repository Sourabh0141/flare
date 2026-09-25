import { Hono } from 'hono';
import type { HealthResponse } from '@flare/contracts';
import type { AppEnv } from '../types.js';

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', (c) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'flare-api',
    version: c.env.APP_VERSION?.trim() || 'dev',
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});
