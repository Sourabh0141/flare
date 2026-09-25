import { timeoutSignal } from '../lib/timeout';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerification {
  success: boolean;
  reason: string | null;
}

/**
 * Verifies a Cloudflare Turnstile token. Turnstile is free; this is the only server-side
 * step it needs. Failures to reach the verifier are reported as failed verification so a
 * bot cannot benefit from an outage.
 */
export async function verifyTurnstile(
  secretKey: string,
  token: string,
  remoteIp: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerification> {
  const form = new FormData();
  form.append('secret', secretKey);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  const { signal, release } = timeoutSignal(8_000);
  try {
    const response = await fetchImpl(VERIFY_URL, { method: 'POST', body: form, signal });
    if (!response.ok) {
      return { success: false, reason: `verifier responded ${response.status}` };
    }
    const data = (await response.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };
    return {
      success: data.success === true,
      reason: data.success ? null : (data['error-codes']?.join(', ') ?? 'rejected'),
    };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : 'unreachable' };
  } finally {
    release();
  }
}
