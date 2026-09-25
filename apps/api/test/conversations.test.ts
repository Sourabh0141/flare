import { describe, expect, it } from 'vitest';
import { call, countRows, readJson, seedConversation, seedMessages } from './helpers';

interface ConversationDto {
  id: string;
  title: string;
  updatedAt: number;
}

describe('conversations', () => {
  it('lists nothing for a new user', async () => {
    const response = await call('/api/conversations', { userId: 'user_a' });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ conversations: [], nextCursor: null });
  });

  it('paginates most-recent-first with an opaque cursor', async () => {
    const base = 1_700_000_000;
    for (let i = 0; i < 5; i += 1) {
      await seedConversation('user_a', { title: `c${i}`, updatedAt: base + i });
    }
    await seedConversation('user_b', { title: 'other', updatedAt: base + 100 });

    const first = await readJson<{ conversations: ConversationDto[]; nextCursor: string | null }>(
      await call('/api/conversations?limit=2', { userId: 'user_a' })
    );
    expect(first.conversations.map((c) => c.title)).toEqual(['c4', 'c3']);
    expect(first.nextCursor).toBeTruthy();

    const second = await readJson<{ conversations: ConversationDto[]; nextCursor: string | null }>(
      await call(`/api/conversations?limit=2&cursor=${first.nextCursor}`, { userId: 'user_a' })
    );
    expect(second.conversations.map((c) => c.title)).toEqual(['c2', 'c1']);

    const third = await readJson<{ conversations: ConversationDto[]; nextCursor: string | null }>(
      await call(`/api/conversations?limit=2&cursor=${second.nextCursor}`, { userId: 'user_a' })
    );
    expect(third.conversations.map((c) => c.title)).toEqual(['c0']);
    expect(third.nextCursor).toBeNull();
  });

  it('validates the page size', async () => {
    const response = await call('/api/conversations?limit=0', { userId: 'user_a' });
    expect(response.status).toBe(400);
  });

  it('returns a transcript in chronological order', async () => {
    const id = await seedConversation('user_a');
    await seedMessages(id, 3);

    const body = await readJson<{ messages: Array<{ role: string; content: string }> }>(
      await call(`/api/conversations/${id}`, { userId: 'user_a' })
    );
    expect(body.messages.map((m) => m.content)).toEqual([
      'user message 1',
      'assistant message 2',
      'user message 3',
    ]);
  });

  it('hides conversations that belong to someone else', async () => {
    const id = await seedConversation('user_a');
    expect((await call(`/api/conversations/${id}`, { userId: 'user_b' })).status).toBe(404);
    expect(
      (
        await call(`/api/conversations/${id}`, {
          method: 'PATCH',
          userId: 'user_b',
          json: { title: 'stolen' },
        })
      ).status
    ).toBe(404);
    expect(
      (await call(`/api/conversations/${id}`, { method: 'DELETE', userId: 'user_b' })).status
    ).toBe(404);
  });

  it('renames a conversation', async () => {
    const id = await seedConversation('user_a', { title: 'Old' });
    const response = await call(`/api/conversations/${id}`, {
      method: 'PATCH',
      userId: 'user_a',
      json: { title: '  Weekend plans ' },
    });
    expect(response.status).toBe(200);
    const body = await readJson<{ conversation: ConversationDto }>(response);
    expect(body.conversation.title).toBe('Weekend plans');
  });

  it('deletes a conversation together with its messages', async () => {
    const id = await seedConversation('user_a');
    await seedMessages(id, 4);
    const response = await call(`/api/conversations/${id}`, { method: 'DELETE', userId: 'user_a' });
    expect(response.status).toBe(204);
    expect(await countRows('conversations')).toBe(0);
    expect(await countRows('messages')).toBe(0);
  });
});
