import { describe, expect, it } from 'vitest';
import { call, countRows, readJson, seedConversation, seedMessages } from './helpers';

interface UserDto {
  id: string;
  displayName: string;
  voice: string;
  persona: string;
  createdAt: number;
}

describe('settings', () => {
  it('creates a default profile on first read', async () => {
    const response = await call('/api/settings', { userId: 'user_new' });
    expect(response.status).toBe(200);
    const body = await readJson<{ user: UserDto }>(response);
    expect(body.user).toMatchObject({
      id: 'user_new',
      displayName: 'Friend',
      voice: 'af_heart',
      persona: 'warm',
    });
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
    const body = await readJson<{ user: UserDto }>(response);
    expect(body.user.displayName).toBe('Ada Lovelace');

    const again = await readJson<{ user: UserDto }>(
      await call('/api/settings', { userId: 'user_new' })
    );
    expect(again.user.displayName).toBe('Ada Lovelace');
  });

  it('changes voice and personality independently of the name', async () => {
    await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_new',
      json: { displayName: 'Ada' },
    });
    const response = await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_new',
      json: { voice: 'bm_george', persona: 'witty' },
    });
    expect(response.status).toBe(200);
    const body = await readJson<{ user: UserDto }>(response);
    expect(body.user).toMatchObject({ displayName: 'Ada', voice: 'bm_george', persona: 'witty' });
  });

  it('rejects unknown voices, personas and empty updates', async () => {
    for (const json of [{ voice: 'robot_9000' }, { persona: 'grumpy' }, {}]) {
      const response = await call('/api/settings', { method: 'PATCH', userId: 'user_new', json });
      expect(response.status, JSON.stringify(json)).toBe(400);
    }
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

  it('erases the account together with every conversation and message', async () => {
    const mine = await seedConversation('user_a');
    await seedMessages(mine, 4);
    const theirs = await seedConversation('user_b');
    await seedMessages(theirs, 2);

    const response = await call('/api/settings', { method: 'DELETE', userId: 'user_a' });
    expect(response.status).toBe(204);
    expect(await countRows('users', "id = 'user_a'")).toBe(0);
    expect(await countRows('conversations', `id = '${mine}'`)).toBe(0);
    expect(await countRows('messages', `conversation_id = '${mine}'`)).toBe(0);
    // Other users are untouched.
    expect(await countRows('messages', `conversation_id = '${theirs}'`)).toBe(2);

    // The next request starts a fresh profile.
    const fresh = await readJson<{ user: UserDto }>(
      await call('/api/settings', { userId: 'user_a' })
    );
    expect(fresh.user.displayName).toBe('Friend');
  });
});
