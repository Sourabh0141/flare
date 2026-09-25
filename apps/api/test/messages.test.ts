import { describe, expect, it } from 'vitest';
import { call, readJson, seedConversation, stubUpstream, testEnv } from './helpers.js';

async function seedAssistantMessage(conversationId: string, content: string, role = 'assistant') {
  const id = crypto.randomUUID();
  await testEnv.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, emotion, gesture, created_at)
     VALUES (?, ?, ?, ?, 'happy', 'none', ?)`
  )
    .bind(id, conversationId, role, content, Math.floor(Date.now() / 1000))
    .run();
  return id;
}

describe('GET /api/messages/:id/audio', () => {
  it('streams synthesized speech for an owned assistant message', async () => {
    const conversationId = await seedConversation('user_a');
    const messageId = await seedAssistantMessage(conversationId, 'Good morning, Ada.');
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
    const { calls } = stubUpstream({
      speech: () => new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
    });

    const response = await call(`/api/messages/${messageId}/audio`, { userId: 'user_a' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(audio);

    const request = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(request).toMatchObject({
      model: testEnv.DEEPINFRA_TTS_MODEL,
      voice: testEnv.DEEPINFRA_TTS_VOICE,
      input: 'Good morning, Ada.',
      response_format: 'mp3',
    });
  });

  it('refuses user messages and messages owned by others', async () => {
    const mine = await seedConversation('user_a');
    const userMessage = await seedAssistantMessage(mine, 'said by me', 'user');
    expect((await call(`/api/messages/${userMessage}/audio`, { userId: 'user_a' })).status).toBe(
      404
    );

    const theirs = await seedConversation('user_b');
    const theirMessage = await seedAssistantMessage(theirs, 'private');
    expect((await call(`/api/messages/${theirMessage}/audio`, { userId: 'user_a' })).status).toBe(
      404
    );
  });

  it('surfaces provider failures as 502', async () => {
    const conversationId = await seedConversation('user_a');
    const messageId = await seedAssistantMessage(conversationId, 'Hello');
    stubUpstream({ speech: () => new Response('quota', { status: 429 }) });

    const response = await call(`/api/messages/${messageId}/audio`, { userId: 'user_a' });
    expect(response.status).toBe(502);
    const body = await readJson<{ error: { code: string } }>(response);
    expect(body.error.code).toBe('upstream_error');
  });
});
