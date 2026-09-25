import { describe, expect, it } from 'vitest';
import { call, readJson } from './helpers';

describe('public surface', () => {
  it('reports health at / and /api/health', async () => {
    for (const path of ['/', '/api/health']) {
      const response = await call(path);
      expect(response.status).toBe(200);
      const body = await readJson(response);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('flare-api');
      expect(typeof body.version).toBe('string');
    }
  });

  it('returns the contract error shape for unknown routes', async () => {
    const response = await call('/nope');
    expect(response.status).toBe(404);
    const body = await readJson<{ error: { code: string; requestId: string } }>(response);
    expect(body.error.code).toBe('not_found');
    expect(body.error.requestId).toBeTruthy();
    expect(response.headers.get('x-request-id')).toBe(body.error.requestId);
  });

  it('echoes a caller-supplied request id', async () => {
    const response = await call('/api/health', { headers: { 'x-request-id': 'abc-123' } });
    expect(response.headers.get('x-request-id')).toBe('abc-123');
  });
});

describe('CORS', () => {
  it('answers preflight for an allowed origin', async () => {
    const response = await call('/api/settings', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'authorization'
    );
  });

  it('matches wildcard preview origins', async () => {
    const response = await call('/api/health', {
      headers: { origin: 'https://feature-branch.preview.example.com' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://feature-branch.preview.example.com'
    );
  });

  it('does not reflect unknown origins', async () => {
    const response = await call('/api/health', { headers: { origin: 'https://evil.example.org' } });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
