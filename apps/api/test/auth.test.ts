import { describe, expect, it } from 'vitest';
import { call, readJson } from './helpers';

describe('authentication guard', () => {
  it('rejects requests without an Authorization header', async () => {
    const response = await call('/api/settings');
    expect(response.status).toBe(401);
    const body = await readJson<{ error: { code: string } }>(response);
    expect(body.error.code).toBe('unauthorized');
  });

  it('rejects non-bearer schemes and empty tokens', async () => {
    for (const value of ['Basic abc', 'Bearer', 'Bearer   ']) {
      const response = await call('/api/settings', { headers: { authorization: value } });
      expect(response.status, value).toBe(401);
    }
  });

  it('rejects tokens the verifier does not accept', async () => {
    const response = await call('/api/settings', { token: 'forged-token' });
    expect(response.status).toBe(401);
    const body = await readJson<{ error: { message: string } }>(response);
    expect(body.error.message).toMatch(/sign in again/i);
  });

  it('accepts a valid token and scopes data to its subject', async () => {
    const response = await call('/api/settings', { userId: 'user_alpha' });
    expect(response.status).toBe(200);
    const body = await readJson<{ user: { id: string } }>(response);
    expect(body.user.id).toBe('user_alpha');
  });
});
