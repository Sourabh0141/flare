'use client';

import { LIMITS } from '@flare/contracts';
import { useEffect, useState, type FormEvent } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { describeError } from '@/lib/api/client';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { TextField } from '../ui/text-field';

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** What Flare calls you. The form mounts fresh each time the dialog opens. */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      description="Flare uses your name when it talks to you."
    >
      {open ? <SettingsForm onClose={onClose} /> : null}
    </Dialog>
  );
}

type FormStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error';

function SettingsForm({ onClose }: { onClose: () => void }) {
  const api = useApiClient();
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<FormStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getSettings(controller.signal)
      .then((user) => {
        if (controller.signal.aborted) return;
        setDisplayName(user.displayName);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(describeError(cause));
        setStatus('error');
      });
    return () => controller.abort();
  }, [api]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError('Enter a name so Flare knows what to call you.');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      const user = await api.updateDisplayName(name);
      setDisplayName(user.displayName);
      setStatus('saved');
      setTimeout(onClose, 700);
    } catch (cause) {
      setError(describeError(cause));
      setStatus('ready');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <TextField
        label="Your name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        maxLength={LIMITS.displayNameMax}
        disabled={status === 'loading' || status === 'saving'}
        placeholder={status === 'loading' ? 'Loading' : 'How should Flare address you?'}
        error={error}
        autoComplete="nickname"
      />
      <div className="flex items-center justify-end gap-2">
        {status === 'saved' ? <span className="mr-auto text-sm text-moss">Saved</span> : null}
        <Button variant="ghost" onClick={onClose} disabled={status === 'saving'}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={status === 'saving'}
          disabled={status === 'loading' || status === 'error'}
        >
          Save name
        </Button>
      </div>
    </form>
  );
}
