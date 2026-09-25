import { describe, expect, it } from 'vitest';
import {
  call,
  chatResponse,
  countRows,
  createExecutionContext,
  jsonResponse,
  readJson,
  seedConversation,
  seedMessages,
  stubUpstream,
  testEnv,
} from './helpers.js';

const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

describe('POST /api/turns/transcribe', () => {
  it('rejects bodies that are not audio', async () => {
    const response = await call('/api/turns/transcribe', {
      userId: 'user_a',
      body: 'hello',
      headers: { 'content-type': 'text/plain' },
    });
    expect(response.status).toBe(415);
  });

  it('rejects empty recordings', async () => {
    const response = await call('/api/turns/transcribe', {
      method: 'POST',
      userId: 'user_a',
      body: new Uint8Array(0),
      headers: { 'content-type': 'audio/webm' },
    });
    expect(response.status).toBe(400);
  });

  it('rejects oversized recordings up front', async () => {
    const response = await call('/api/turns/transcribe', {
      userId: 'user_a',
      body: webmBytes,
      headers: { 'content-type': 'audio/webm', 'content-length': String(50 * 1024 * 1024) },
    });
    expect(response.status).toBe(413);
  });

  it('forwards the audio to the speech-to-text model and returns the transcript', async () => {
    const { calls } = stubUpstream({
      transcription: () => jsonResponse({ text: '  Hello there.  ', language: 'en' }),
    });

    const response = await call('/api/turns/transcribe', {
      userId: 'user_a',
      body: webmBytes,
      headers: { 'content-type': 'audio/webm;codecs=opus' },
    });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ transcript: 'Hello there.', language: 'en' });

    const upstream = calls[0];
    expect(upstream?.url).toBe('https://api.deepinfra.com/v1/openai/audio/transcriptions');
    const headers = new Headers(upstream?.init.headers);
    expect(headers.get('authorization')).toBe('Bearer test-deepinfra-key');
    const form = upstream?.init.body as FormData;
    expect(form.get('model')).toBe(testEnv.DEEPINFRA_STT_MODEL);
    const file = form.get('file') as File;
    expect(file.name).toBe('utterance.webm');
    expect(file.size).toBe(webmBytes.byteLength);
  });

  it('maps silence to a 422 the client can explain', async () => {
    stubUpstream({ transcription: () => jsonResponse({ text: '' }) });
    const response = await call('/api/turns/transcribe', {
      userId: 'user_a',
      body: webmBytes,
      headers: { 'content-type': 'audio/webm' },
    });
    expect(response.status).toBe(422);
    const body = await readJson<{ error: { code: string } }>(response);
    expect(body.error.code).toBe('no_speech_detected');
  });

  it('maps provider failures to 502 without leaking the provider body', async () => {
    stubUpstream({ transcription: () => new Response('internal secret trace', { status: 500 }) });
    const response = await call('/api/turns/transcribe', {
      userId: 'user_a',
      body: webmBytes,
      headers: { 'content-type': 'audio/webm' },
    });
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('secret trace');
    expect(JSON.parse(text).error.code).toBe('upstream_error');
  });
});

describe('POST /api/turns/respond', () => {
  it('validates the transcript', async () => {
    const response = await call('/api/turns/respond', {
      userId: 'user_a',
      json: { transcript: '' },
    });
    expect(response.status).toBe(400);
  });

  it('starts a conversation, persists both messages, and titles it in one model call', async () => {
    const { calls } = stubUpstream({
      chat: () =>
        chatResponse({
          reply: 'Hi! Lovely to meet you.',
          emotion: 'happy',
          gesture: 'nod',
          title: 'First hello',
        }),
    });

    const { ctx, settle } = createExecutionContext();
    const response = await call('/api/turns/respond', {
      userId: 'user_a',
      json: { transcript: 'Hello, I am Ada.' },
      ctx,
    });
    expect(response.status).toBe(200);
    const body = await readJson<{
      conversation: { id: string; title: string };
      isNewConversation: boolean;
      userMessage: { role: string; content: string };
      assistantMessage: { role: string; content: string; emotion: string; gesture: string };
    }>(response);

    expect(body.isNewConversation).toBe(true);
    expect(body.conversation.title).toBe('First hello');
    expect(body.userMessage).toMatchObject({ role: 'user', content: 'Hello, I am Ada.' });
    expect(body.assistantMessage).toMatchObject({
      role: 'assistant',
      content: 'Hi! Lovely to meet you.',
      emotion: 'happy',
      gesture: 'nod',
    });

    await settle();
    expect(calls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(1);
    expect(await countRows('messages')).toBe(2);

    const request = JSON.parse(String(calls[0]?.init.body)) as {
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.response_format).toEqual({ type: 'json_object' });
    expect(request.messages[0]?.content).toContain('"title"');
  });

  it('continues a warm conversation with context and no title request', async () => {
    const id = await seedConversation('user_a', { title: 'Existing' });
    await seedMessages(id, 4);
    const { calls } = stubUpstream({
      chat: () => chatResponse({ reply: 'Still here.', emotion: 'neutral', gesture: 'none' }),
    });

    const body = await readJson<{
      conversation: { id: string; title: string };
      isNewConversation: boolean;
    }>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { conversationId: id, transcript: 'Are you there?' },
      })
    );
    expect(body.isNewConversation).toBe(false);
    expect(body.conversation).toMatchObject({ id, title: 'Existing' });

    const request = JSON.parse(String(calls[0]?.init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[0]?.content).not.toContain('"title"');
    // system + 4 history + the new user turn
    expect(request.messages).toHaveLength(6);
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Are you there?' });
  });

  it('branches into a new conversation after 30 minutes of inactivity', async () => {
    const stale = await seedConversation('user_a', {
      updatedAt: Math.floor(Date.now() / 1000) - 31 * 60,
    });
    stubUpstream({
      chat: () =>
        chatResponse({ reply: 'Welcome back.', emotion: 'happy', gesture: 'none', title: 'Back' }),
    });

    const body = await readJson<{ conversation: { id: string }; isNewConversation: boolean }>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { conversationId: stale, transcript: 'Hi again' },
      })
    );
    expect(body.isNewConversation).toBe(true);
    expect(body.conversation.id).not.toBe(stale);
    expect(await countRows('conversations')).toBe(2);
  });

  it("does not continue another user's conversation", async () => {
    const theirs = await seedConversation('user_b');
    stubUpstream({
      chat: () =>
        chatResponse({ reply: 'Hello.', emotion: 'neutral', gesture: 'none', title: 'Hello' }),
    });
    const body = await readJson<{ conversation: { id: string }; isNewConversation: boolean }>(
      await call('/api/turns/respond', {
        userId: 'user_a',
        json: { conversationId: theirs, transcript: 'Hi' },
      })
    );
    expect(body.isNewConversation).toBe(true);
    expect(body.conversation.id).not.toBe(theirs);
    expect(await countRows('messages', `conversation_id = '${theirs}'`)).toBe(0);
  });

  it('degrades gracefully when the model improvises enum values or breaks JSON', async () => {
    stubUpstream({
      chat: () => chatResponse({ reply: '**Sure!**', emotion: 'ecstatic', gesture: 'moonwalk' }),
    });
    let body = await readJson<{
      assistantMessage: { content: string; emotion: string; gesture: string };
    }>(await call('/api/turns/respond', { userId: 'user_a', json: { transcript: 'Dance!' } }));
    expect(body.assistantMessage).toMatchObject({
      content: 'Sure!',
      emotion: 'neutral',
      gesture: 'none',
    });

    stubUpstream({ chat: () => chatResponse('Plain text, no JSON at all.') });
    body = await readJson(
      await call('/api/turns/respond', { userId: 'user_a', json: { transcript: 'Again?' } })
    );
    expect(body.assistantMessage.content).toBe('Plain text, no JSON at all.');
  });

  it('returns 502 and persists nothing from the model when it fails', async () => {
    stubUpstream({ chat: () => new Response('nope', { status: 503 }) });
    const response = await call('/api/turns/respond', {
      userId: 'user_a',
      json: { transcript: 'Hi' },
    });
    expect(response.status).toBe(502);
    // The user's transcript is kept so the thread is not lost; no assistant row exists.
    expect(await countRows('messages', "role = 'assistant'")).toBe(0);
  });

  it('folds the oldest messages into a summary once the thread grows past the threshold', async () => {
    const id = await seedConversation('user_a');
    await seedMessages(id, 19);
    const { calls } = stubUpstream({
      chat: ({ init }) => {
        const request = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> };
        const isSummary = request.messages[0]?.content.startsWith('Summarise');
        return isSummary
          ? chatResponse('Ada introduced herself and asked about the weather.')
          : chatResponse({ reply: 'Noted.', emotion: 'thoughtful', gesture: 'none' });
      },
    });

    const { ctx, settle } = createExecutionContext();
    const response = await call('/api/turns/respond', {
      userId: 'user_a',
      json: { conversationId: id, transcript: 'Message twenty' },
      ctx,
    });
    expect(response.status).toBe(200);
    await settle();

    expect(calls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(2);
    expect(await countRows('messages', "role = 'summary'")).toBe(1);
    // 19 seeded + 2 new = 21 live, minus the 10 folded = 11 live messages remain.
    expect(await countRows('messages', "role != 'summary'")).toBe(11);

    // The summary now leads the context on the next turn.
    const next = await readJson<{ messages: Array<{ role: string }> }>(
      await call(`/api/conversations/${id}`, { userId: 'user_a' })
    );
    expect(next.messages[0]?.role).toBe('summary');
  });
});
