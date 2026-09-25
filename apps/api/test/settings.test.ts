import { describe, expect, it } from 'vitest';
import { call, countRows, readJson } from './helpers.js';

describe('settings', () => {
  it('creates a default profile on first read', async () => {
    const response = await call('/api/settings', { userId: 'user_new' });
    expect(response.status).toBe(200);
    const body = await readJson<{ user: { id: string; displayName: string; createdAt: number } }>(
      response
    );
    expect(body.user).toMatchObject({ id: 'user_new', displayName: 'Friend' });
    expect(body.user.createdAt).toBeGreaterThan(0);
    expect(await countRows('users')).toBe(1);
  });

  it('updates the display name and trims whitespace', async () => {
    const response = await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_new',
      json: { displayName: '  Ada Lovelace  ' },
    });
    expect(response.status).toBe(200);
    const body = await readJson<{ user: { displayName: string } }>(response);
    expect(body.user.displayName).toBe('Ada Lovelace');

    const again = await readJson<{ user: { displayName: string } }>(
      await call('/api/settings', { userId: 'user_new' })
    );
    expect(again.user.displayName).toBe('Ada Lovelace');
  });

  it('rejects invalid payloads with structured details', async () => {
    const response = await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_new',
      json: { displayName: '' },
    });
    expect(response.status).toBe(400);
    const body = await readJson<{ error: { code: string; details: Array<{ path: string }> } }>(
      response
    );
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.details[0]?.path).toBe('displayName');
  });

  it('rejects malformed JSON bodies', async () => {
    const response = await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_new',
      body: '{not json',
      headers: { 'content-type': 'application/json' },
    });
    expect(response.status).toBe(400);
  });
});
