import { Hono } from 'hono';
import type { HealthResponse } from '@flare/contracts';
import { DeepInfraClient } from '../services/deepinfra';
import type { AppEnv } from '../types';

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', (c) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'flare-api',
    version: c.env.APP_VERSION?.trim() || 'dev',
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});

healthRoutes.get('/diag', async (c) => {
  const rawKey = (c.env.DEEPINFRA_API_KEY ?? '').trim();
  const keyDiagnostics = {
    configured: Boolean(rawKey),
    length: rawKey.length,
    hasWhitespace: /\s/.test(rawKey),
    hasAngleBrackets: rawKey.includes('<') || rawKey.includes('>'),
    hasQuotes: /^["'].*["']$/.test(rawKey),
    masked: rawKey.length > 8 ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}` : '(too short/missing)',
  };

  const started = Date.now();
  let upstreamTest: Record<string, unknown> = {};

  try {
    const sanitizedKey = rawKey.replace(/^["']|["']$/g, '').trim();
    const res = await fetch('https://api.deepinfra.com/v1/openai/models', {
      headers: {
        authorization: `Bearer ${sanitizedKey}`,
      },
    });
    const body = await res.text();
    upstreamTest = {
      reachable: true,
      status: res.status,
      statusText: res.statusText,
      durationMs: Date.now() - started,
      responseSnippet: body.slice(0, 300),
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    upstreamTest = {
      reachable: false,
      durationMs: Date.now() - started,
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
      errorCause: 'cause' in err && err.cause ? String(err.cause) : null,
    };
  }

  let clientSpeechTest: Record<string, unknown> = {};
  if (upstreamTest.reachable) {
    try {
      const client = new DeepInfraClient({ apiKey: rawKey });
      const speech = await client.speak({
        model: c.env.DEEPINFRA_TTS_MODEL || 'hexgrad/Kokoro-82M',
        voice: 'af_heart',
        text: 'Hello from Flare diagnostics.',
      });
      const bytes = await new Response(speech.body).arrayBuffer();
      clientSpeechTest = {
        ok: true,
        audioBytes: bytes.byteLength,
        contentType: speech.contentType,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      clientSpeechTest = {
        ok: false,
        name: error.name,
        message: error.message,
      };
    }
  }

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    key: keyDiagnostics,
    deepinfra: upstreamTest,
    clientSpeech: clientSpeechTest,
  });
});
