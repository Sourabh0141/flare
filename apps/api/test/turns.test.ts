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
} from './helpers';
import type { TurnEvent } from '@flare/contracts';
import {
  chatStreamResponse,
  eventOfType,
  eventsOfType,
  lastEvent,
  mp3Response,
  readTurnEvents,
} from './stream-helpers';

const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

function respond(json: Record<string, unknown>, ctx?: ExecutionContext) {
  return call('/api/turns/respond', { userId: 'user_a', json, ...(ctx ? { ctx } : {}) });
}

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

describe('POST /api/turns/respond (server-sent events)', () => {
  it('validates the transcript before streaming', async () => {
    const response = await respond({ transcript: '' });
    expect(response.status).toBe(400);
  });

  it('streams meta, expression, sentences with audio, and a persisted reply', async () => {
    const { calls } = stubUpstream({
      chat: () =>
        chatStreamResponse(
          '[happy|nod|0.7|First hello]\nHi Ada! Lovely to meet you. What brings you here today?'
        ),
      speech: () => mp3Response(),
    });

    const { ctx, settle } = createExecutionContext();
    const response = await respond({ transcript: 'Hello, I am Ada.', language: 'en' }, ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const events = await readTurnEvents<TurnEvent>(response);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('meta');
    expect(types[1]).toBe('expression');
    expect(types.at(-1)).toBe('done');
    expect(types).not.toContain('error');

    const meta = eventOfType(events, 'meta');
    expect(meta.isNewConversation).toBe(true);
    expect(meta.language).toBe('en');

    const expression = eventOfType(events, 'expression');
    expect(expression.expression).toEqual({ emotion: 'happy', gesture: 'nod', intensity: 0.7 });

    const sentences = eventsOfType(events, 'sentence');
    expect(sentences.map((s) => s.text)).toEqual([
      'Hi Ada!',
      'Lovely to meet you.',
      'What brings you here today?',
    ]);

    const audio = eventsOfType(events, 'audio');
    expect(audio.map((a) => a.index)).toEqual([0, 1, 2]);
    expect(audio[0]?.mimeType).toBe('audio/mpeg');
    expect(Buffer.from(audio[0]?.data ?? '', 'base64')).toEqual(Buffer.from([0xff, 0xfb, 0x90, 0]));

    const done = lastEvent(events, 'done');
    expect(done.assistantMessage).toMatchObject({
      content: 'Hi Ada! Lovely to meet you. What brings you here today?',
      emotion: 'happy',
      gesture: 'nod',
      intensity: 0.7,
      language: 'en',
    });
    expect(done.conversation.title).toBe('First hello');

    await settle();
    expect(await countRows('messages')).toBe(2);
    // One streaming chat call, three sentence syntheses.
    expect(calls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(1);
    expect(calls.filter((c) => c.url.endsWith('/audio/speech'))).toHaveLength(3);
    const chatRequest = JSON.parse(String(calls[0]?.init.body)) as {
      stream: boolean;
      messages: Array<{ content: string }>;
    };
    expect(chatRequest.stream).toBe(true);
    expect(chatRequest.messages[0]?.content).toContain('[emotion|gesture|intensity|title]');
  });

  it('answers in the spoken language with a native voice and no title request on warm threads', async () => {
    const id = await seedConversation('user_a', { title: 'Existing' });
    await seedMessages(id, 4, { startAt: Math.floor(Date.now() / 1000) - 86_400 });
    await call('/api/settings', {
      method: 'PATCH',
      userId: 'user_a',
      json: { voice: 'am_michael' },
    });
    const { calls } = stubUpstream({
      chat: () => chatStreamResponse('[thoughtful|none|0.4]\nClaro, sigo aquí.'),
      speech: () => mp3Response(),
    });

    const events = await readTurnEvents<TurnEvent>(
      await respond({ conversationId: id, transcript: '¿Sigues ahí?', language: 'es' })
    );
    const meta = eventOfType(events, 'meta');
    expect(meta.isNewConversation).toBe(false);
    expect(meta.language).toBe('es');

    const chatRequest = JSON.parse(String(calls[0]?.init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(chatRequest.messages[0]?.content).toContain('plain Spanish');
    expect(chatRequest.messages[0]?.content).not.toContain('title');
    // system + 4 history + the new user turn
    expect(chatRequest.messages).toHaveLength(6);

    const speech = JSON.parse(String(calls.at(-1)?.init.body)) as { voice: string };
    expect(speech.voice).toBe('em_alex'); // masculine Spanish, matching the user's register

    const done = lastEvent(events, 'done');
    expect(done.type).toBe('done');
    expect(done.assistantMessage.language).toBe('es');
  });

  it('copes with a reply that has no tag line', async () => {
    stubUpstream({
      chat: () => chatStreamResponse('Just plain text here. Nothing tagged at all.'),
      speech: () => mp3Response(),
    });
    const events = await readTurnEvents<TurnEvent>(await respond({ transcript: 'Hi' }));
    const expression = eventOfType(events, 'expression');
    expect(expression.expression.emotion).toBe('neutral');
    const done = lastEvent(events, 'done');
    expect(done.type).toBe('done');
    expect(done.assistantMessage.content).toBe('Just plain text here. Nothing tagged at all.');
  });

  it('branches into a new conversation after 30 minutes of inactivity', async () => {
    const stale = await seedConversation('user_a', {
      updatedAt: Math.floor(Date.now() / 1000) - 31 * 60,
    });
    stubUpstream({
      chat: () => chatStreamResponse('[happy|none|0.5|Back]\nWelcome back.'),
      speech: () => mp3Response(),
    });
    const events = await readTurnEvents<TurnEvent>(
      await respond({ conversationId: stale, transcript: 'Hi again' })
    );
    const meta = eventOfType(events, 'meta');
    expect(meta.isNewConversation).toBe(true);
    expect(meta.conversation.id).not.toBe(stale);
    expect(await countRows('conversations')).toBe(2);
  });

  it("does not continue another user's conversation", async () => {
    const theirs = await seedConversation('user_b');
    stubUpstream({
      chat: () => chatStreamResponse('[neutral|none|0.5|Hello]\nHello.'),
      speech: () => mp3Response(),
    });
    const events = await readTurnEvents<TurnEvent>(
      await respond({ conversationId: theirs, transcript: 'Hi' })
    );
    const meta = eventOfType(events, 'meta');
    expect(meta.isNewConversation).toBe(true);
    expect(meta.conversation.id).not.toBe(theirs);
    expect(await countRows('messages', `conversation_id = '${theirs}'`)).toBe(0);
  });

  it('emits an error event and keeps no assistant row when the model fails', async () => {
    stubUpstream({ chat: () => new Response('nope', { status: 503 }) });
    const events = await readTurnEvents<TurnEvent>(await respond({ transcript: 'Hi' }));
    expect(events[0]?.type).toBe('meta');
    const error = lastEvent(events, 'error');
    expect(error.type).toBe('error');
    expect(error.code).toBe('upstream_error');
    expect(await countRows('messages', "role = 'assistant'")).toBe(0);
  });

  it('still completes the reply when one sentence fails to synthesise', async () => {
    let speechCalls = 0;
    stubUpstream({
      chat: () =>
        chatStreamResponse('[amused|laugh|0.8|Jokes]\nFirst one works. Second one breaks.'),
      speech: () => {
        speechCalls += 1;
        return speechCalls === 2 ? new Response('boom', { status: 500 }) : mp3Response();
      },
    });
    const events = await readTurnEvents<TurnEvent>(await respond({ transcript: 'Tell me a joke' }));
    expect(eventsOfType(events, 'audio').map((e) => e.index)).toEqual([0]);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('folds the oldest messages into a summary once the thread grows past the threshold', async () => {
    const id = await seedConversation('user_a');
    // Dated in the past so the seeded turns do not count against today's cap.
    await seedMessages(id, 19, { startAt: Math.floor(Date.now() / 1000) - 2 * 86_400 });
    const { calls } = stubUpstream({
      chat: ({ init }) => {
        const request = JSON.parse(String(init.body)) as {
          stream?: boolean;
          messages: Array<{ content: string }>;
        };
        return request.stream
          ? chatStreamResponse('[thoughtful|none|0.5]\nNoted.')
          : chatResponse('Ada introduced herself and asked about the weather.');
      },
      speech: () => mp3Response(),
    });

    const { ctx, settle } = createExecutionContext();
    const response = await respond({ conversationId: id, transcript: 'Message twenty' }, ctx);
    const events = await readTurnEvents<TurnEvent>(response);
    expect(events.at(-1)?.type).toBe('done');
    await settle();

    expect(calls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(2);
    expect(await countRows('messages', "role = 'summary'")).toBe(1);
    // 19 seeded + 2 new = 21 live, minus the 10 folded = 11 live messages remain.
    expect(await countRows('messages', "role != 'summary'")).toBe(11);

    const next = await readJson<{ messages: Array<{ role: string }> }>(
      await call(`/api/conversations/${id}`, { userId: 'user_a' })
    );
    expect(next.messages[0]?.role).toBe('summary');
  });
});
