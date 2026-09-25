'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Modal built on the native <dialog> element: focus trapping, Escape handling and inert
 * backgrounds come from the platform.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop (the dialog itself, not its content) closes it.
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      className={cn(
        'm-auto w-[min(92vw,28rem)] rounded-lg border border-ash bg-soot p-0 text-linen shadow-lift',
        'backdrop:bg-ink-deep/70 backdrop:backdrop-blur-sm',
        'open:animate-rise-in',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div className="flex flex-col gap-1">
          <h2 id="dialog-title" className="type-heading text-xl">
            {title}
          </h2>
          {description ? (
            <p id="dialog-description" className="text-sm text-linen-dim">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-2">
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="px-6 pt-4 pb-6">{children}</div>
    </dialog>
  );
}
