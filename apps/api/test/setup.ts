import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, vi } from 'vitest';

interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
}

const testEnv = env as unknown as TestEnv;

/**
 * Clerk is replaced by a deterministic verifier: a token of the form `user:<id>` is valid
 * and resolves to that subject; anything else is rejected.
 */
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token.startsWith('user:')) {
      return { sub: token.slice('user:'.length), sid: 'sess_test', iss: 'https://clerk.test' };
    }
    throw new Error('Invalid token');
  }),
}));

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await testEnv.DB.batch([
    testEnv.DB.prepare('DELETE FROM messages'),
    testEnv.DB.prepare('DELETE FROM conversations'),
    testEnv.DB.prepare('DELETE FROM users'),
  ]);
  vi.unstubAllGlobals();
});
