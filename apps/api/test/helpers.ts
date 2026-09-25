import { env } from 'cloudflare:workers';
import { vi } from 'vitest';
import { createApp } from '../src/app';

export const app = createApp();

/** Bindings as the Worker sees them in tests (secrets injected by vitest.config.ts). */
export const testEnv = env as unknown as Env;

/** ExecutionContext stand-in that records background work so tests can await it. */
export function createExecutionContext() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext,
    settle: async () => {
      await Promise.allSettled(pending);
    },
  };
}

export interface CallOptions {
  method?: string;
  userId?: string | null;
  token?: string;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  ctx?: ExecutionContext;
  /** Override bindings for one call (for example to add an optional secret). */
  env?: Env;
}

/** Issues a request to the in-process app with optional auth and JSON body. */
export async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  } else if (options.userId) {
    headers.set('authorization', `Bearer user:${options.userId}`);
  }

  let body = options.body;
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const { ctx } = createExecutionContext();
  return app.request(
    `https://api.test${path}`,
    { method: options.method ?? (body ? 'POST' : 'GET'), headers, ...(body ? { body } : {}) },
    options.env ?? testEnv,
    options.ctx ?? ctx
  );
}

export async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

// -----------------------------------------------------------------------------
// DeepInfra fetch stubbing
// -----------------------------------------------------------------------------

export interface UpstreamCall {
  url: string;
  init: RequestInit;
}

export interface UpstreamHandlers {
  transcription?: (call: UpstreamCall) => Response | Promise<Response>;
  chat?: (call: UpstreamCall) => Response | Promise<Response>;
  speech?: (call: UpstreamCall) => Response | Promise<Response>;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function chatResponse(
  payload: unknown,
  usage = { prompt_tokens: 80, completion_tokens: 30 }
) {
  return jsonResponse({
    choices: [
      { message: { content: typeof payload === 'string' ? payload : JSON.stringify(payload) } },
    ],
    usage,
  });
}

/**
 * Replaces global fetch so DeepInfra endpoints are served by the given handlers. Any other
 * URL fails loudly; the API must never call something a test did not anticipate.
 */
export function stubUpstream(handlers: UpstreamHandlers) {
  const calls: UpstreamCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const record = { url, init };
    calls.push(record);

    if (url.endsWith('/audio/transcriptions') && handlers.transcription) {
      return handlers.transcription(record);
    }
    if (url.endsWith('/chat/completions') && handlers.chat) {
      return handlers.chat(record);
    }
    if (url.endsWith('/audio/speech') && handlers.speech) {
      return handlers.speech(record);
    }
    throw new Error(`Unexpected upstream call: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

// -----------------------------------------------------------------------------
// Data seeding helpers (direct D1 access)
// -----------------------------------------------------------------------------

export async function seedConversation(
  userId: string,
  options: { title?: string; updatedAt?: number; id?: string } = {}
) {
  const id = options.id ?? crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const updatedAt = options.updatedAt ?? now;
  await testEnv.DB.batch([
    testEnv.DB.prepare(
      'INSERT OR IGNORE INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, 'Tester', now, now),
    testEnv.DB.prepare(
      'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, userId, options.title ?? 'Seeded', updatedAt, updatedAt),
  ]);
  return id;
}

export async function seedMessages(
  conversationId: string,
  count: number,
  options: { startAt?: number } = {}
) {
  const startAt = options.startAt ?? Math.floor(Date.now() / 1000) - count * 2;
  const statements = [];
  for (let i = 0; i < count; i += 1) {
    const role = i % 2 === 0 ? 'user' : 'assistant';
    statements.push(
      testEnv.DB.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, emotion, gesture, created_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?)`
      ).bind(crypto.randomUUID(), conversationId, role, `${role} message ${i + 1}`, startAt + i)
    );
  }
  await testEnv.DB.batch(statements);
}

export async function countRows(
  table: 'users' | 'conversations' | 'messages' | 'invite_requests',
  where = '1=1'
) {
  const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).first<{
    n: number;
  }>();
  return row?.n ?? 0;
}
