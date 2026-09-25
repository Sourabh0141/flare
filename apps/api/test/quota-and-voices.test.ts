import { describe, expect, it } from 'vitest';
import { call, readJson, seedConversation, seedMessages, stubUpstream, testEnv } from './helpers';
import type { TurnEvent } from '@flare/contracts';
import {
  chatStreamResponse,
  eventOfType,
  lastEvent,
  mp3Response,
  readTurnEvents,
} from './stream-helpers';

describe('daily turn cap', () => {
  it('reports remaining turns and refuses once the cap is reached', async () => {
    const id = await seedConversation('user_a');
    // DAILY_TURN_LIMIT is 5 in tests; seed 4 user turns today (8 alternating messages).
    await seedMessages(id, 8, { startAt: Math.floor(Date.now() / 1000) - 100 });
    stubUpstream({
      chat: () => chatStreamResponse('[neutral|none|0.5]\nOkay then.'),
      speech: () => mp3Response(),
    });

    const events = await readTurnEvents<TurnEvent>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { conversationId: id, transcript: 'Fifth turn' },
      })
    );
    expect(eventOfType(events, 'meta').turnsRemainingToday).toBe(0);

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
      chat: () => chatStreamResponse('[happy|none|0.5]\nMorning to you.'),
      speech: () => mp3Response(),
    });
    const events = await readTurnEvents<TurnEvent>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { conversationId: id, transcript: 'New day' },
      })
    );
    expect(eventOfType(events, 'meta').turnsRemainingToday).toBe(4);
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
      chat: () => chatStreamResponse('[amused|laugh|0.8|Jokes]\nHa, that one lands.'),
      speech: () => mp3Response(),
    });

    const events = await readTurnEvents<TurnEvent>(
      await call('/api/turns/respond', { userId: 'user_a', json: { transcript: 'Tell me a joke' } })
    );
    const chatRequest = JSON.parse(String(calls[0]?.init.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(chatRequest.messages[0]?.content).toContain('quick and dry');

    const done = lastEvent(events, 'done');
    const audio = await call(`/api/messages/${done.assistantMessage.id}/audio`, {
      userId: 'user_a',
    });
    expect(audio.status).toBe(200);
    const speechRequest = JSON.parse(String(calls.at(-1)?.init.body)) as { voice: string };
    expect(speechRequest.voice).toBe('bf_emma');
  });

  it('replays a reply spoken in another language with a native voice', async () => {
    stubUpstream({
      chat: () => chatStreamResponse('[happy|none|0.5|Bonjour]\nBonjour, ravie de vous parler.'),
      speech: () => mp3Response(),
    });
    const events = await readTurnEvents<TurnEvent>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { transcript: 'Bonjour', language: 'fr-FR' },
      })
    );
    const done = lastEvent(events, 'done');
    expect(done.assistantMessage.language).toBe('fr');

    const { calls } = stubUpstream({ speech: () => mp3Response() });
    await call(`/api/messages/${done.assistantMessage.id}/audio`, { userId: 'user_a' });
    expect((JSON.parse(String(calls[0]?.init.body)) as { voice: string }).voice).toBe('ff_siwis');
  });
});

describe('GET /api/voices/:id/preview', () => {
  it('speaks the fixed sample in the requested voice', async () => {
    const { calls } = stubUpstream({ speech: () => mp3Response([9, 9]) });
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
