import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError, describeError } from './client';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('ApiClient', () => {
  const client = new ApiClient(async () => 'token-123', 'https://api.test');

  it('attaches the bearer token and validates the response shape', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        user: {
          id: 'u1',
          displayName: 'Ada',
          voice: 'af_heart',
          persona: 'warm',
          createdAt: 1,
          updatedAt: 1,
        },
      })
    );
    const user = await client.getSettings();
    expect(user.displayName).toBe('Ada');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/settings');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-123');
  });

  it('rejects responses that do not match the contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: { id: 'u1' } }));
    await expect(client.getSettings()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('maps contract errors to typed client errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { code: 'rate_limited', message: 'Slow down', requestId: 'r1' } }, 429)
    );
    const error = await client.getSettings().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: 'rate_limited', status: 429, requestId: 'r1' });
    expect(describeError(error)).toMatch(/slow down/i);
  });

  it('sends audio as a raw body with its content type', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ transcript: 'hello', language: 'en' }));
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });
    const result = await client.transcribe(blob);
    expect(result.transcript).toBe('hello');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('content-type')).toBe('audio/webm');
    expect(init.body).toBe(blob);
  });

  it('fails fast without a session token', async () => {
    const anonymous = new ApiClient(async () => null, 'https://api.test');
    await expect(anonymous.getSettings()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('reports network failures in plain language', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await client.getSettings().catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'network' });
    expect(describeError(error)).toMatch(/connection/i);
  });
});
