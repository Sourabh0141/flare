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

// Mock DeepInfra client functions
vi.mock('../src/deepinfra.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/deepinfra.js')>();
  return {
    ...actual,
    transcribeAudio: vi.fn().mockImplementation(async (apiKey, audio, options) => {
      if (apiKey === 'invalid_key') {
        throw new Error('DeepInfra ASR authentication error');
      }
      return 'Hello Flare, how are you today?';
    }),
    generateChatCompletion: vi.fn().mockImplementation(async (apiKey, messages, options) => {
      if (apiKey === 'fail_llm') {
        throw new Error('DeepInfra LLM rate limit');
      }
      return 'Hello! I am doing wonderfully, ready to chat with you.';
    }),
    generateConversationTitle: vi.fn().mockImplementation(async () => {
      return 'Greeting Flare';
    }),
    synthesizeSpeech: vi.fn().mockImplementation(async (apiKey, text, options) => {
      if (apiKey === 'fail_tts') {
        throw new Error('DeepInfra TTS 503 unavailable');
      }
      const dummyAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x64]); // Mock MP3 header bytes
      return {
        audioBuffer: dummyAudio.buffer,
        contentType: 'audio/mpeg',
      };
    }),
  };
});

import app from '../src/index.js';

// In-memory mock D1 database implementation for chat turn testing
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
          if (query.includes('SELECT updated_at FROM conversations WHERE id = ?') || query.includes('FROM conversations WHERE id = ?')) {
            const conv = conversations.get(boundParams[0]);
            return (conv as unknown as T) || null;
          }
          if (query.includes('SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? AND role = \'summary\'')) {
            return null;
          }
          return null;
        },
        all: async <T = unknown>(): Promise<{ results: T[] }> => {
          if (query.includes('FROM messages WHERE conversation_id = ? AND role != \'summary\'')) {
            const convMsgs = Array.from(messages.values())
              .filter((m) => m.conversation_id === boundParams[0] && m.role !== 'summary')
              .sort((a, b) => a.created_at - b.created_at);
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
          if (query.includes('UPDATE conversations SET updated_at = ? WHERE id = ?')) {
            const conv = conversations.get(boundParams[1]);
            if (conv) {
              conv.updated_at = boundParams[0];
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (query.includes('INSERT INTO messages')) {
            messages.set(boundParams[0], {
              id: boundParams[0],
              conversation_id: boundParams[1],
              role: boundParams[2],
              content: boundParams[3],
              created_at: boundParams[4],
            });
            return { meta: { changes: 1 } };
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
    _getMessages: () => Array.from(messages.values()),
    _getConversations: () => Array.from(conversations.values()),
    _setConversationUpdatedAt: (id: string, timestamp: number) => {
      const conv = conversations.get(id);
      if (conv) conv.updated_at = timestamp;
    },
  };
}

describe('POST /api/chat - Conversation Turn Pipeline (Unit 5)', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  const mockEnv = (apiKey = 'valid_deepinfra_key') => ({
    DB: mockDb as unknown as D1Database,
    CLERK_SECRET_KEY: 'sk_test_mock_clerk_key',
    DEEPINFRA_API_KEY: apiKey,
    DEEPINFRA_STT_MODEL: 'openai/whisper-large-v3-turbo',
    DEEPINFRA_LLM_MODEL: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    DEEPINFRA_TTS_MODEL: 'hexgrad/Kokoro-82M',
    DEEPINFRA_TTS_VOICE: 'af_heart',
  });

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const formData = new FormData();
    formData.append('audio', new Blob(['fake-audio-bytes'], { type: 'audio/wav' }), 'audio.wav');

    const res = await app.request('/api/chat', {
      method: 'POST',
      body: formData,
    }, mockEnv());

    expect(res.status).toBe(401);
    const json = await res.json<{ error: string }>();
    expect(json.error).toBe('Unauthorized');
  });

  it('rejects requests missing the audio file with 400 BadRequest', async () => {
    const formData = new FormData();
    formData.append('conversationId', 'some-conv-id');

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid_token_user_123',
      },
      body: formData,
    }, mockEnv());

    expect(res.status).toBe(400);
    const json = await res.json<{ error: string; message: string }>();
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain('audio');
  });

  it('successfully processes full voice turn (ASR -> LLM -> TTS) and persists to D1', async () => {
    const formData = new FormData();
    formData.append('audio', new Blob(['test-audio-content'], { type: 'audio/wav' }), 'test.wav');

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid_token_user_123',
      },
      body: formData,
    }, mockEnv());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');

    const conversationId = res.headers.get('X-Conversation-Id');
    expect(conversationId).toBeDefined();
    expect(conversationId).not.toBeNull();

    const userTranscript = decodeURIComponent(res.headers.get('X-User-Transcript') || '');
    expect(userTranscript).toBe('Hello Flare, how are you today?');

    const assistantText = decodeURIComponent(res.headers.get('X-Assistant-Response') || '');
    expect(assistantText).toContain('Hello! I am doing wonderfully');

    // Verify binary audio body was returned
    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBe(4);

    // Verify D1 database records were inserted
    const storedMessages = mockDb._getMessages();
    expect(storedMessages.length).toBe(2);

    const userMsg = storedMessages.find((m) => m.role === 'user');
    const assistantMsg = storedMessages.find((m) => m.role === 'assistant');

    expect(userMsg).toBeDefined();
    expect(userMsg?.content).toBe('Hello Flare, how are you today?');

    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toContain('Hello! I am doing wonderfully');

    // Verify conversation was created and title auto-generated (R19)
    const storedConvs = mockDb._getConversations();
    expect(storedConvs.length).toBe(1);
    expect(storedConvs[0].title).toBe('Greeting Flare');
  });

  it('branches a new conversation when existing conversation is older than 30 minutes (R18)', async () => {
    // 1. Setup an existing conversation created 35 minutes ago
    const oldTimestamp = Math.floor(Date.now() / 1000) - 35 * 60;
    await mockDb.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?)')
      .bind('old_inactive_conv', 'user_123', 'Old Chat', oldTimestamp, oldTimestamp)
      .run();

    const formData = new FormData();
    formData.append('audio', new Blob(['test-audio'], { type: 'audio/wav' }), 'turn.wav');
    formData.append('conversationId', 'old_inactive_conv');

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid_token_user_123',
      },
      body: formData,
    }, mockEnv());

    expect(res.status).toBe(200);

    const newConversationId = res.headers.get('X-Conversation-Id');
    expect(newConversationId).toBeDefined();
    // Must be a newly created conversation ID, not the old inactive one
    expect(newConversationId).not.toBe('old_inactive_conv');

    const storedConvs = mockDb._getConversations();
    expect(storedConvs.length).toBe(2);
  });

  it('returns 503 ServiceUnavailable when DeepInfra fails (R32 / AE3)', async () => {
    const formData = new FormData();
    formData.append('audio', new Blob(['test-audio'], { type: 'audio/wav' }), 'turn.wav');

    // Test with API key configured to trigger mock TTS failure
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid_token_user_123',
      },
      body: formData,
    }, mockEnv('fail_tts'));

    expect(res.status).toBe(503);
    const json = await res.json<{ error: string; message: string; details: string }>();
    expect(json.error).toBe('ServiceUnavailable');
    expect(json.details).toContain('DeepInfra TTS 503 unavailable');
  });
});
