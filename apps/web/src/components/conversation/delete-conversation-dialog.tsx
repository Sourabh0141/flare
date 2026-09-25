'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

export interface DeleteConversationDialogProps {
  target: { id: string; title: string } | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<string | null>;
}

export function DeleteConversationDialog({
  target,
  onClose,
  onConfirm,
}: DeleteConversationDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const failure = await onConfirm(target.id);
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title="Delete this conversation?"
      description={
        target
          ? `"${target.title}" and everything said in it will be removed. This can't be undone.`
          : undefined
      }
    >
      {error ? <p className="mb-4 text-sm text-rust">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Keep it
        </Button>
        <Button variant="danger" onClick={() => void confirm()} loading={busy}>
          Delete conversation
        </Button>
      </div>
    </Dialog>
  );
}
