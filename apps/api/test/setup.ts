import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, vi } from 'vitest';

interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
}

const testEnv = env as unknown as TestEnv;

/** Records of Clerk Backend API calls made through the mocked client. */
export const clerkCalls = {
  invitations: [] as Array<{ emailAddress: string; redirectUrl?: string }>,
  /** Users whose public metadata marks them as admin when looked up over the API. */
  apiAdmins: new Set<string>(),
};

/**
 * Clerk is replaced by a deterministic verifier: `user:<id>` is a valid token for that
 * subject; `admin:<id>` is valid and carries an admin role claim; anything else is rejected.
 * The Backend API client records invitations and answers role lookups from `apiAdmins`.
 */
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token.startsWith('user:')) {
      return { sub: token.slice('user:'.length), sid: 'sess_test', iss: 'https://clerk.test' };
    }
    if (token.startsWith('admin:')) {
      return {
        sub: token.slice('admin:'.length),
        sid: 'sess_admin',
        iss: 'https://clerk.test',
        metadata: { role: 'admin' },
      };
    }
    throw new Error('Invalid token');
  }),
  createClerkClient: vi.fn(() => ({
    users: {
      getUser: async (id: string) => ({
        id,
        publicMetadata: clerkCalls.apiAdmins.has(id) ? { role: 'admin' } : {},
      }),
    },
    invitations: {
      createInvitation: async (input: { emailAddress: string; redirectUrl?: string }) => {
        clerkCalls.invitations.push(input);
        return { id: `inv_${clerkCalls.invitations.length}` };
      },
    },
  })),
}));

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await testEnv.DB.batch([
    testEnv.DB.prepare('DELETE FROM messages'),
    testEnv.DB.prepare('DELETE FROM conversations'),
    testEnv.DB.prepare('DELETE FROM users'),
    testEnv.DB.prepare('DELETE FROM invite_requests'),
  ]);
  clerkCalls.invitations.length = 0;
  clerkCalls.apiAdmins.clear();
  vi.unstubAllGlobals();
});
