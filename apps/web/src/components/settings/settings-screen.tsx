'use client';

import { useClerk } from '@clerk/clerk-react';
import {
  LIMITS,
  PERSONAS,
  VOICES,
  type PersonaId,
  type User,
  type VoiceId,
} from '@flare/contracts';
import { ArrowLeft, Play, Square } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { describeError } from '@/lib/api/client';
import { getVoicePlayer } from '@/lib/audio/player';
import { readPrefs, writePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { TextField } from '../ui/text-field';
import { Wordmark } from '../ui/wordmark';

type Status = 'loading' | 'ready' | 'saving' | 'error';

/** Everything about how Flare talks to you, plus the door out. */
export function SettingsScreen() {
  const api = useApiClient();
  const { signOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [handsFreeDefault, setHandsFreeDefault] = useState(false);
  const [previewing, setPreviewing] = useState<VoiceId | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getSettings(controller.signal)
      .then((u) => {
        if (controller.signal.aborted) return;
        setUser(u);
        setName(u.displayName);
        setHandsFreeDefault(readPrefs().handsFreeByDefault);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(describeError(cause));
        setStatus('error');
      });
    return () => controller.abort();
  }, [api]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    const player = getVoicePlayer();
    const unsubscribe = player.subscribe((event) => {
      if (event === 'ended' || event === 'error' || event === 'stop') setPreviewing(null);
    });
    return () => {
      unsubscribe();
      player.stop();
    };
  }, []);

  const save = async (
    patch: { displayName?: string; voice?: VoiceId; persona?: PersonaId },
    label: string
  ) => {
    setStatus('saving');
    setError(null);
    try {
      const updated = await api.updateSettings(patch);
      setUser(updated);
      setName(updated.displayName);
      setSaved(label);
      setStatus('ready');
    } catch (cause) {
      setError(describeError(cause));
      setStatus('ready');
    }
  };

  const submitName = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name so Flare knows what to call you.');
      return;
    }
    if (trimmed === user?.displayName) return;
    void save({ displayName: trimmed }, 'Name saved');
  };

  const preview = async (voice: VoiceId) => {
    const player = getVoicePlayer();
    if (previewing === voice) {
      player.stop();
      return;
    }
    setPreviewing(voice);
    try {
      const blob = await api.fetchVoicePreview(voice);
      await player.play(blob);
    } catch (cause) {
      setPreviewing(null);
      setError(describeError(cause));
    }
  };

  const erase = async () => {
    setErasing(true);
    try {
      await api.deleteAccountData();
      await signOut({ redirectUrl: '/' });
    } catch (cause) {
      setErasing(false);
      setError(describeError(cause));
    }
  };

  const busy = status === 'loading' || status === 'saving';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-md" aria-label="Flare home">
          <Wordmark />
        </Link>
        <Link
          href="/app/"
          className="type-ui inline-flex h-9 items-center gap-2 rounded-md px-3 text-[15px] text-linen-dim transition-colors hover:text-linen"
        >
          <ArrowLeft className="size-4" /> Back to Flare
        </Link>
      </div>

      <h1 className="type-display mt-10 text-4xl text-linen sm:text-5xl">Settings</h1>
      <p className="mt-3 max-w-xl text-linen-dim">
        How Flare talks to you. Changes apply to your next turn.
      </p>

      <div className="mt-4 min-h-6 text-sm" aria-live="polite">
        {error ? <span className="text-rust">{error}</span> : null}
        {saved ? <span className="text-moss">{saved}</span> : null}
      </div>

      {status === 'error' && !user ? (
        <Button variant="secondary" className="self-start" onClick={() => window.location.reload()}>
          Reload
        </Button>
      ) : null}

      <Section title="Your name" description="Flare uses it when it talks to you.">
        <form onSubmit={submitName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={LIMITS.displayNameMax}
              disabled={busy}
              autoComplete="nickname"
            />
          </div>
          <Button type="submit" loading={status === 'saving'} disabled={busy}>
            Save name
          </Button>
        </form>
      </Section>

      <Section
        title="Voice"
        description="Tap a name to hear it. The choice applies to every reply, including replays."
      >
        <div role="radiogroup" aria-label="Voice" className="grid gap-2 sm:grid-cols-2">
          {VOICES.map((voice) => {
            const selected = user?.voice === voice.id;
            const isPreviewing = previewing === voice.id;
            return (
              <div
                key={voice.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                  selected
                    ? 'border-ember bg-ember/10'
                    : 'border-ash bg-soot/50 hover:border-ash-soft'
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => void save({ voice: voice.id }, `Voice set to ${voice.label}`)}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span className="text-[15px] font-medium text-linen">
                    {voice.label}
                    <span className="ml-2 text-xs text-smoke">{voice.accent}</span>
                  </span>
                  <span className="text-sm text-linen-dim">{voice.note}</span>
                </button>
                <button
                  type="button"
                  aria-label={isPreviewing ? `Stop ${voice.label}` : `Preview ${voice.label}`}
                  onClick={() => void preview(voice.id)}
                  className={cn(
                    'inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
                    isPreviewing
                      ? 'bg-ember text-ink'
                      : 'bg-soot-raised text-linen-dim hover:text-linen'
                  )}
                >
                  {isPreviewing ? (
                    <Square className="size-4 fill-current" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Personality"
        description="One line in Flare's instructions. Everything else about how it behaves stays the same."
      >
        <div role="radiogroup" aria-label="Personality" className="grid gap-2 sm:grid-cols-2">
          {PERSONAS.map((persona) => {
            const selected = user?.persona === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() =>
                  void save({ persona: persona.id }, `Personality set to ${persona.label}`)
                }
                className={cn(
                  'flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-ember bg-ember/10'
                    : 'border-ash bg-soot/50 hover:border-ash-soft'
                )}
              >
                <span className="text-[15px] font-medium text-linen">{persona.label}</span>
                <span className="text-sm text-linen-dim">{persona.description}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="On this device" description="Remembered in this browser only.">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-ash bg-soot/50 px-3 py-2.5">
          <span>
            <span className="block text-[15px] font-medium text-linen">Start hands-free</span>
            <span className="block text-sm text-linen-dim">
              Open the microphone as soon as Flare loads.
            </span>
          </span>
          <input
            type="checkbox"
            checked={handsFreeDefault}
            onChange={(event) => {
              setHandsFreeDefault(event.target.checked);
              writePrefs({ handsFreeByDefault: event.target.checked, seenWelcome: true });
            }}
            className="size-5 accent-ember"
          />
        </label>
      </Section>

      <Section
        title="Your data"
        description="Recordings are never kept. Transcripts and these settings are, until you remove them."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-sm text-linen-dim">
            Erase every conversation and preference Flare holds for you. Your sign-in account stays;
            you can come back and start fresh.
          </p>
          <Button variant="danger" onClick={() => setConfirmErase(true)} disabled={busy}>
            Erase my data
          </Button>
        </div>
      </Section>

      <Dialog
        open={confirmErase}
        onClose={() => (erasing ? undefined : setConfirmErase(false))}
        title="Erase everything?"
        description="Every conversation and transcript will be deleted and you will be signed out. This can't be undone."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmErase(false)} disabled={erasing}>
            Keep my data
          </Button>
          <Button variant="danger" onClick={() => void erase()} loading={erasing}>
            Erase and sign out
          </Button>
        </div>
      </Dialog>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-ash/60 pt-8">
      <h2 className="type-heading text-2xl text-linen">{title}</h2>
      <p className="mt-1 max-w-xl text-sm text-linen-dim">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
