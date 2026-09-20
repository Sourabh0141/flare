import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './auth.js';
import { healthRoutes } from './routes/health.js';
import { settingsRoutes } from './routes/settings.js';
import { conversationsRoutes } from './routes/conversations.js';
import { chatRoutes } from './routes/chat.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

// =============================================================================
// Global Middleware: CORS & Preflight Handling
// =============================================================================
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow any requesting origin (supports localhost, *.pages.dev previews, custom domains)
      return origin || '*';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);

// =============================================================================
// Global Error & Not Found Handlers
// =============================================================================
app.onError((err, c) => {
  console.error('Unhandled API Error:', err);
  return c.json(
    {
      error: 'InternalServerError',
      message: err.message || 'An unexpected error occurred.',
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: 'NotFound',
      message: `Path ${c.req.path} not found.`,
    },
    404
  );
});

// =============================================================================
// Public Endpoints (Health Check & Service Info)
// =============================================================================
app.route('/', healthRoutes);
app.route('/api', healthRoutes);

// =============================================================================
// Protected API Routes (Guarded by Clerk JWT authMiddleware)
// =============================================================================
const protectedApi = new Hono<AppEnv>();

protectedApi.use('*', authMiddleware);
protectedApi.route('/settings', settingsRoutes);
protectedApi.route('/conversations', conversationsRoutes);
protectedApi.route('/chat', chatRoutes);

// Mount protected API routes under /api
app.route('/api', protectedApi);

export default app;
