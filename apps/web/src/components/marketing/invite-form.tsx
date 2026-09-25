'use client';

import { LIMITS } from '@flare/contracts';
import { useCallback, useState, type FormEvent } from 'react';
import { ApiClient, describeError } from '@/lib/api/client';
import { config } from '@/lib/config';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { TurnstileWidget } from './turnstile-widget';

const publicApi = new ApiClient(async () => null);

/** Asks for an invitation. Works without Turnstile; uses it when a site key is configured. */
export function InviteForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [website, setWebsite] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const onToken = useCallback((value: string | null) => setToken(value), []);

  const needsToken = Boolean(config.turnstileSiteKey);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Add your name and the email you want the invitation sent to.');
      return;
    }
    if (needsToken && !token) {
      setError('Complete the verification below, then send again.');
      return;
    }
    setStatus('sending');
    try {
      await publicApi.requestInvite({
        name: name.trim(),
        email: email.trim(),
        reason: reason.trim(),
        ...(token ? { turnstileToken: token } : {}),
        ...(website ? { website } : {}),
      });
      setStatus('sent');
    } catch (cause) {
      setStatus('idle');
      setError(describeError(cause));
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-moss/40 bg-moss/10 p-6" role="status">
        <h2 className="type-heading text-xl text-linen">Request received</h2>
        <p className="mt-2 text-linen-dim">
          Thanks, {name.trim()}. If there is room, an invitation goes to {email.trim()} from
          Flare&apos;s sign-in provider. It will not arrive the same minute; invitations are sent by
          hand.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <TextField
        label="Your name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={LIMITS.inviteNameMax}
        autoComplete="name"
        required
      />
      <TextField
        label="Email for the invitation"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        inputMode="email"
        required
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-reason" className="text-sm font-medium text-linen">
          What would you use Flare for? <span className="font-normal text-smoke">(optional)</span>
        </label>
        <textarea
          id="invite-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={LIMITS.inviteReasonMax}
          rows={3}
          className="rounded-md border border-ash bg-ink px-3 py-2 text-[15px] text-linen placeholder:text-smoke hover:border-ash-soft focus:border-ember focus:outline-none"
          placeholder="Practising a language, thinking out loud, curiosity about the character..."
        />
        <span className="text-xs text-smoke">
          {reason.length}/{LIMITS.inviteReasonMax}
        </span>
      </div>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="absolute top-auto -left-[9999px]" aria-hidden="true">
        <label htmlFor="invite-website">Website</label>
        <input
          id="invite-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {config.turnstileSiteKey ? (
        <TurnstileWidget siteKey={config.turnstileSiteKey} onToken={onToken} />
      ) : null}

      {error ? (
        <p className="text-sm text-rust" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-smoke">Your email is used only to send the invitation.</p>
        <Button type="submit" size="lg" loading={status === 'sending'}>
          Request an invite
        </Button>
      </div>
    </form>
  );
}
