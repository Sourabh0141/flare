import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clerk/backend verifyToken
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn().mockImplementation(async (token: string) => {
    if (token === 'valid_token_user_123') {
      return {
        sub: 'user_123',
        iss: 'https://clerk.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
    }
    throw new Error('Invalid token');
  }),
}));

import app from '../src/index.js';

// Simple mock D1 database implementation for route testing
function createMockDb() {
  const users = new Map<string, { id: string; display_name: string; created_at: number; updated_at: number }>();
  const conversations = new Map<string, { id: string; user_id: string; title: string; created_at: number; updated_at: number }>();
  const messages = new Map<string, { id: string; conversation_id: string; role: string; content: string; created_at: number }>();

  return {
    prepare: (query: string) => {
      let boundParams: any[] = [];
      const statement = {
        bind: (...params: any[]) => {
          boundParams = params;
          return statement;
        },
        first: async <T = unknown>(): Promise<T | null> => {
          if (query.includes('FROM users WHERE id = ?')) {
            const user = users.get(boundParams[0]);
            return (user as unknown as T) || null;
          }
          if (query.includes('FROM conversations WHERE id = ? AND user_id = ?')) {
            const conv = conversations.get(boundParams[0]);
            if (conv && conv.user_id === boundParams[1]) {
              return conv as unknown as T;
            }
            return null;
          }
          if (query.includes('FROM conversations WHERE id = ?')) {
            const conv = conversations.get(boundParams[0]);
            return (conv as unknown as T) || null;
          }
          return null;
        },
        all: async <T = unknown>(): Promise<{ results: T[] }> => {
          if (query.includes('FROM conversations WHERE user_id = ?')) {
            const userConvs = Array.from(conversations.values()).filter((c) => c.user_id === boundParams[0]);
            return { results: userConvs as unknown as T[] };
          }
          if (query.includes('FROM messages WHERE conversation_id = ?')) {
            const convMsgs = Array.from(messages.values()).filter((m) => m.conversation_id === boundParams[0]);
            return { results: convMsgs as unknown as T[] };
          }
          return { results: [] };
        },
        run: async () => {
          if (query.includes('INSERT INTO users')) {
            users.set(boundParams[0], {
              id: boundParams[0],
              display_name: boundParams[1],
              created_at: boundParams[2],
              updated_at: boundParams[3],
            });
            return { meta: { changes: 1 } };
          }
          if (query.includes('UPDATE users SET display_name = ?')) {
            const user = users.get(boundParams[2]);
            if (user) {
              user.display_name = boundParams[0];
              user.updated_at = boundParams[1];
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (query.includes('INSERT INTO conversations')) {
            conversations.set(boundParams[0], {
              id: boundParams[0],
              user_id: boundParams[1],
              title: boundParams[2],
              created_at: boundParams[3],
              updated_at: boundParams[4],
            });
            return { meta: { changes: 1 } };
          }
          if (query.includes('UPDATE conversations SET title = ?')) {
            const conv = conversations.get(boundParams[2]);
            if (conv && conv.user_id === boundParams[3]) {
              conv.title = boundParams[0];
              conv.updated_at = boundParams[1];
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (query.includes('DELETE FROM conversations WHERE id = ?')) {
            const conv = conversations.get(boundParams[0]);
            if (conv && conv.user_id === boundParams[1]) {
              conversations.delete(boundParams[0]);
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
    batch: async (statements: any[]) => {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };
}

describe('API Worker - Unit 4 Verification', () => {
  let mockDb: any;
  const mockEnv = () => ({
    DB: mockDb,
    CLERK_SECRET_KEY: 'sk_test_mock_clerk_key',
  });

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('Public Endpoints & CORS', () => {
    it('GET / should return 200 OK with service status', async () => {
      const res = await app.request('/', {}, mockEnv());
      expect(res.status).toBe(200);

      const json = await res.json<{ status: string; service: string }>();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('flare-api');
    });

    it('GET /api/health should return 200 OK', async () => {
      const res = await app.request('/api/health', {}, mockEnv());
      expect(res.status).toBe(200);

      const json = await res.json<{ status: string; service: string }>();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('flare-api');
    });

    it('OPTIONS request should handle CORS preflight correctly', async () => {
      const res = await app.request('/api/settings', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
      }, mockEnv());

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
    });

    it('GET /nonexistent should return 404 NotFound', async () => {
      const res = await app.request('/nonexistent', {}, mockEnv());
      expect(res.status).toBe(404);

      const json = await res.json<{ error: string }>();
      expect(json.error).toBe('NotFound');
    });
  });

  describe('Authentication Guard (Requirement R5 & R23)', () => {
    it('GET /api/settings should reject requests without Authorization header with 401', async () => {
      const res = await app.request('/api/settings', {}, mockEnv());
      expect(res.status).toBe(401);

      const json = await res.json<{ error: string; message: string }>();
      expect(json.error).toBe('Unauthorized');
      expect(json.message).toContain('Missing or malformed Authorization header');
    });

    it('GET /api/settings should reject malformed Authorization headers with 401', async () => {
      const res = await app.request('/api/settings', {
        headers: {
          Authorization: 'Basic invalid_creds',
        },
      }, mockEnv());
      expect(res.status).toBe(401);

      const json = await res.json<{ error: string }>();
      expect(json.error).toBe('Unauthorized');
    });

    it('rejects invalid or expired token with 401', async () => {
      const res = await app.request('/api/settings', {
        headers: {
          Authorization: 'Bearer expired_or_corrupt_token',
        },
      }, mockEnv());
      expect(res.status).toBe(401);

      const json = await res.json<{ error: string; message: string }>();
      expect(json.error).toBe('Unauthorized');
      expect(json.message).toContain('Invalid or expired session token');
    });
  });

  describe('Authenticated Settings Endpoints (Requirements R40, R41)', () => {
    const authHeaders = {
      Authorization: 'Bearer valid_token_user_123',
      'Content-Type': 'application/json',
    };

    it('GET /api/settings creates and returns default profile for new user', async () => {
      const res = await app.request('/api/settings', {
        headers: authHeaders,
      }, mockEnv());

      expect(res.status).toBe(200);
      const json = await res.json<{ user: { id: string; display_name: string } }>();
      expect(json.user.id).toBe('user_123');
      expect(json.user.display_name).toBe('User');
    });

    it('PATCH /api/settings updates user display name successfully', async () => {
      const res = await app.request('/api/settings', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ displayName: 'Alex Mercer' }),
      }, mockEnv());

      expect(res.status).toBe(200);
      const json = await res.json<{ user: { id: string; display_name: string } }>();
      expect(json.user.display_name).toBe('Alex Mercer');
    });

    it('PATCH /api/settings rejects invalid empty payload with 400', async () => {
      const res = await app.request('/api/settings', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ displayName: '   ' }),
      }, mockEnv());

      expect(res.status).toBe(400);
      const json = await res.json<{ error: string }>();
      expect(json.error).toBe('BadRequest');
    });
  });

  describe('Authenticated Conversation Endpoints (Requirements R11–R16)', () => {
    const authHeaders = {
      Authorization: 'Bearer valid_token_user_123',
      'Content-Type': 'application/json',
    };

    it('GET /api/conversations returns empty array when no conversations exist', async () => {
      const res = await app.request('/api/conversations', {
        headers: authHeaders,
      }, mockEnv());

      expect(res.status).toBe(200);
      const json = await res.json<{ conversations: any[] }>();
      expect(json.conversations).toEqual([]);
    });

    it('handles conversation retrieval, renaming, and deletion flow', async () => {
      // 1. Manually insert a mock conversation
      await mockDb.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?)')
        .bind('conv_999', 'user_123', 'Initial Title', 1000, 1000)
        .run();

      // 2. Fetch conversations list
      const listRes = await app.request('/api/conversations', {
        headers: authHeaders,
      }, mockEnv());
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json<{ conversations: any[] }>();
      expect(listJson.conversations.length).toBe(1);
      expect(listJson.conversations[0].title).toBe('Initial Title');

      // 3. Get single conversation
      const getRes = await app.request('/api/conversations/conv_999', {
        headers: authHeaders,
      }, mockEnv());
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json<{ conversation: { title: string }; messages: any[] }>();
      expect(getJson.conversation.title).toBe('Initial Title');

      // 4. Rename conversation (PATCH)
      const patchRes = await app.request('/api/conversations/conv_999', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Updated Discussion Title' }),
      }, mockEnv());
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json<{ success: boolean; conversation: { title: string } }>();
      expect(patchJson.success).toBe(true);
      expect(patchJson.conversation.title).toBe('Updated Discussion Title');

      // 5. Delete conversation (DELETE)
      const deleteRes = await app.request('/api/conversations/conv_999', {
        method: 'DELETE',
        headers: authHeaders,
      }, mockEnv());
      expect(deleteRes.status).toBe(200);
      const deleteJson = await deleteRes.json<{ success: boolean }>();
      expect(deleteJson.success).toBe(true);

      // 6. Verify deleted conversation returns 404
      const getDeletedRes = await app.request('/api/conversations/conv_999', {
        headers: authHeaders,
      }, mockEnv());
      expect(getDeletedRes.status).toBe(404);
    });
  });
});
