import { describe, expect, it } from 'vitest';
import {
  call,
  chatResponse,
  readJson,
  seedConversation,
  seedMessages,
  stubUpstream,
  testEnv,
} from './helpers';

describe('daily turn cap', () => {
  it('reports remaining turns and refuses once the cap is reached', async () => {
    const id = await seedConversation('user_a');
    // DAILY_TURN_LIMIT is 5 in tests; seed 4 user turns today (8 alternating messages).
    await seedMessages(id, 8, { startAt: Math.floor(Date.now() / 1000) - 100 });
    stubUpstream({
      chat: () => chatResponse({ reply: 'Okay.', emotion: 'neutral', gesture: 'none' }),
    });

    const fifth = await readJson<{ turnsRemainingToday: number }>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { conversationId: id, transcript: 'Fifth turn' },
      })
    );
    expect(fifth.turnsRemainingToday).toBe(0);

    const sixth = await call('/api/turns/respond', {
      userId: 'user_a',
      json: { conversationId: id, transcript: 'Sixth turn' },
    });
    expect(sixth.status).toBe(429);
    const body = await readJson<{ error: { code: string } }>(sixth);
    expect(body.error.code).toBe('quota_exceeded');
  });

  it('ignores turns from earlier days', async () => {
    const id = await seedConversation('user_a');
    await seedMessages(id, 20, { startAt: Math.floor(Date.now() / 1000) - 3 * 86_400 });
    stubUpstream({
      chat: () => chatResponse({ reply: 'Morning.', emotion: 'happy', gesture: 'none' }),
    });
    const response = await call('/api/turns/respond', {
      userId: 'user_a',
      json: { conversationId: id, transcript: 'New day' },
    });
    expect(response.status).toBe(200);
    expect((await readJson<{ turnsRemainingToday: number }>(response)).turnsRemainingToday).toBe(4);
  });
});

describe('personality and voice preferences', () => {
  it('feeds the chosen personality into the prompt and the chosen voice into speech', async () => {
    await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_a',
      json: { persona: 'witty', voice: 'bf_emma' },
    });
    const { calls } = stubUpstream({
      chat: () =>
        chatResponse({ reply: 'Ha.', emotion: 'amused', gesture: 'laugh', title: 'Jokes' }),
      speech: () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }),
    });

    const turn = await readJson<{ assistantMessage: { id: string } }>(
      await call('/api/turns/respond', { userId: 'user_a', json: { transcript: 'Tell me a joke' } })
    );
    const chatRequest = JSON.parse(String(calls[0]?.init.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(chatRequest.messages[0]?.content).toContain('quick and dry');

    const audio = await call(`/api/messages/${turn.assistantMessage.id}/audio`, {
      userId: 'user_a',
    });
    expect(audio.status).toBe(200);
    const speechRequest = JSON.parse(String(calls.at(-1)?.init.body)) as { voice: string };
    expect(speechRequest.voice).toBe('bf_emma');
  });
});

describe('GET /api/voices/:id/preview', () => {
  it('speaks the fixed sample in the requested voice', async () => {
    const { calls } = stubUpstream({
      speech: () =>
        new Response(new Uint8Array([9, 9]), { headers: { 'content-type': 'audio/mpeg' } }),
    });
    const response = await call('/api/voices/am_adam/preview', { userId: 'user_a' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('86400');
    const request = JSON.parse(String(calls[0]?.init.body)) as {
      voice: string;
      input: string;
      model: string;
    };
    expect(request.voice).toBe('am_adam');
    expect(request.model).toBe(testEnv.DEEPINFRA_TTS_MODEL);
    expect(request.input).toMatch(/I'm Flare/);
  });

  it('refuses unknown voices without calling the provider', async () => {
    const { calls } = stubUpstream({});
    const response = await call('/api/voices/nope/preview', { userId: 'user_a' });
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});
