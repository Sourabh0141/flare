import { describe, expect, it } from 'vitest';
import { call, readJson, testEnv } from './helpers';
import { clerkCalls } from './setup';

const request = { name: 'Ada', email: 'ada@example.com', reason: 'Curious.' };

async function submitInvite(email = request.email) {
  const response = await call('/api/invites', { json: { ...request, email } });
  expect(response.status).toBe(202);
}

describe('admin surface', () => {
  it('tells ordinary users they are not admins without a 403', async () => {
    const response = await call('/api/admin/status', { userId: 'user_a' });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ isAdmin: false });
    expect((await call('/api/admin/invites', { userId: 'user_a' })).status).toBe(403);
  });

  it('recognises the role from the session token', async () => {
    const response = await call('/api/admin/status', { token: 'admin:user_root' });
    expect(await readJson(response)).toEqual({ isAdmin: true });
  });

  it('falls back to a Clerk API lookup when the token carries no role', async () => {
    clerkCalls.apiAdmins.add('user_lookup');
    const env = { ...testEnv, CLERK_SECRET_KEY: 'sk_test' } as Env;
    const response = await call('/api/admin/status', { userId: 'user_lookup', env });
    expect(await readJson(response)).toEqual({ isAdmin: true });
  });

  it('lists pending requests with counts and reviews them', async () => {
    await submitInvite('ada@example.com');
    await submitInvite('bob@example.com');

    const list = await readJson<{
      invites: Array<{ id: string; email: string; status: string }>;
      counts: { pending: number; approved: number; dismissed: number };
    }>(await call('/api/admin/invites', { token: 'admin:user_root' }));
    expect(list.invites.map((i) => i.email)).toEqual(['bob@example.com', 'ada@example.com']);
    expect(list.counts).toEqual({ pending: 2, approved: 0, dismissed: 0 });

    const adaId = list.invites[1]!.id;
    const approved = await readJson<{
      invite: { status: string; reviewedAt: number };
      invitationSent: boolean;
    }>(
      await call(`/api/admin/invites/${adaId}`, {
        method: 'PATCH',
        token: 'admin:user_root',
        json: { status: 'approved' },
      })
    );
    expect(approved.invite.status).toBe('approved');
    expect(approved.invite.reviewedAt).toBeGreaterThan(0);
    // No secret key in the test environment: marked approved, no email sent.
    expect(approved.invitationSent).toBe(false);

    const bobId = list.invites[0]!.id;
    await call(`/api/admin/invites/${bobId}`, {
      method: 'PATCH',
      token: 'admin:user_root',
      json: { status: 'dismissed' },
    });

    const after = await readJson<{ invites: unknown[]; counts: Record<string, number> }>(
      await call('/api/admin/invites?status=approved', { token: 'admin:user_root' })
    );
    expect(after.invites).toHaveLength(1);
    expect(after.counts).toEqual({ pending: 0, approved: 1, dismissed: 1 });
  });

  it('sends a Clerk invitation on approval when a secret key is configured', async () => {
    await submitInvite('ada@example.com');
    const env = { ...testEnv, CLERK_SECRET_KEY: 'sk_test' } as Env;
    const list = await readJson<{ invites: Array<{ id: string }> }>(
      await call('/api/admin/invites', { token: 'admin:user_root', env })
    );
    const result = await readJson<{ invitationSent: boolean }>(
      await call(`/api/admin/invites/${list.invites[0]!.id}`, {
        method: 'PATCH',
        token: 'admin:user_root',
        json: { status: 'approved' },
        env,
      })
    );
    expect(result.invitationSent).toBe(true);
    expect(clerkCalls.invitations).toEqual([
      {
        emailAddress: 'ada@example.com',
        redirectUrl: 'https://app.example.com/sign-up/',
        ignoreExisting: true,
      },
    ]);
  });

  it('rejects unknown ids and invalid statuses', async () => {
    expect(
      (
        await call('/api/admin/invites/nope', {
          method: 'PATCH',
          token: 'admin:user_root',
          json: { status: 'approved' },
        })
      ).status
    ).toBe(404);
    await submitInvite();
    const list = await readJson<{ invites: Array<{ id: string }> }>(
      await call('/api/admin/invites', { token: 'admin:user_root' })
    );
    expect(
      (
        await call(`/api/admin/invites/${list.invites[0]!.id}`, {
          method: 'PATCH',
          token: 'admin:user_root',
          json: { status: 'pending' },
        })
      ).status
    ).toBe(400);
  });
});

describe('OpenAPI', () => {
  it('serves a document generated from the contracts', async () => {
    const response = await call('/api/openapi.json');
    expect(response.status).toBe(200);
    const doc = await readJson<{
      openapi: string;
      paths: Record<string, unknown>;
      components: { schemas: { TurnEvent: unknown } };
    }>(response);
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/api/turns/respond',
        '/api/conversations/{id}',
        '/api/admin/invites/{id}',
      ])
    );
    expect(doc.components.schemas.TurnEvent).toBeTruthy();
  });

  it('serves the reference page', async () => {
    const response = await call('/api/docs');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('/api/openapi.json');
  });
});
