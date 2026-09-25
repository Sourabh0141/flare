'use client';

import { Dialog } from '../ui/dialog';

const shortcuts: Array<[string, string]> = [
  ['Space (hold)', 'Talk while held; release to send'],
  ['Escape', 'Interrupt Flare or cancel a turn'],
  ['M', 'Mute or unmute hands-free'],
  ['?', 'Show these shortcuts'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className="divide-y divide-ash/60">
        {shortcuts.map(([key, action]) => (
          <div key={key} className="grid grid-cols-[8rem_1fr] gap-4 py-2.5">
            <dt>
              <kbd className="rounded-sm border border-ash bg-ink px-2 py-0.5 font-sans text-sm text-linen">
                {key}
              </kbd>
            </dt>
            <dd className="text-sm text-linen-dim">{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
