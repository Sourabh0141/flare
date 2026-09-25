import { describe, expect, it, vi } from 'vitest';
import { call, countRows, jsonResponse, readJson, testEnv } from './helpers';

const valid = { name: 'Ada', email: 'Ada@Example.com', reason: 'I build voice things.' };

describe('POST /api/invites', () => {
  it('stores a request without authentication and normalises the email', async () => {
    const response = await call('/api/invites', {
      json: valid,
      headers: { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'test-agent' },
    });
    expect(response.status).toBe(202);
    expect(await readJson(response)).toEqual({ received: true });

    const row = await testEnv.DB.prepare(
      'SELECT name, email, reason, ip_hash, user_agent FROM invite_requests'
    ).first<{ name: string; email: string; reason: string; ip_hash: string; user_agent: string }>();
    expect(row).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      reason: 'I build voice things.',
      user_agent: 'test-agent',
    });
    // The raw address is never stored.
    expect(row?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.ip_hash).not.toContain('203.0.113.7');
  });

  it('validates the payload', async () => {
    const response = await call('/api/invites', { json: { name: '', email: 'not-an-email' } });
    expect(response.status).toBe(400);
    const body = await readJson<{ error: { details: Array<{ path: string }> } }>(response);
    expect(body.error.details.map((d) => d.path).sort()).toEqual(['email', 'name']);
  });

  it('pretends to accept honeypot submissions and stores nothing', async () => {
    const response = await call('/api/invites', { json: { ...valid, website: 'http://spam' } });
    expect(response.status).toBe(202);
    expect(await countRows('invite_requests')).toBe(0);
  });

  it('caps repeat requests from one address', async () => {
    for (let i = 0; i < 4; i += 1) {
      const response = await call('/api/invites', { json: valid });
      expect(response.status).toBe(202);
    }
    expect(await countRows('invite_requests')).toBe(3);
  });

  it('requires and verifies a Turnstile token when the secret is configured', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('turnstile/v0/siteverify')) {
        const form = init?.body as FormData;
        return jsonResponse({ success: form.get('response') === 'good-token' });
      }
      throw new Error(`Unexpected call ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = { ...testEnv, TURNSTILE_SECRET_KEY: 'secret' } as Env;

    const missing = await call('/api/invites', { json: valid, env });
    expect(missing.status).toBe(400);

    const bad = await call('/api/invites', { json: { ...valid, turnstileToken: 'bad' }, env });
    expect(bad.status).toBe(400);

    const good = await call('/api/invites', {
      json: { ...valid, turnstileToken: 'good-token' },
      env,
    });
    expect(good.status).toBe(202);
    expect(await countRows('invite_requests')).toBe(1);
  });
});
