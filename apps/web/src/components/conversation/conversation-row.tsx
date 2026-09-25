'use client';

import type { Conversation } from '@flare/contracts';
import { LIMITS } from '@flare/contracts';
import { Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { IconButton } from '../ui/icon-button';

export interface ConversationRowProps {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<string | null>;
  onDelete: () => void;
}

export function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: ConversationRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const beginRename = () => {
    setDraft(conversation.title);
    setError(null);
    setMenuOpen(false);
    setEditing(true);
  };

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title || title === conversation.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const failure = await onRename(title);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={submitRename}
        className="flex flex-col gap-1 rounded-md bg-soot-raised px-2 py-1.5"
      >
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setEditing(false);
            }}
            maxLength={LIMITS.conversationTitleMax}
            aria-label="Conversation name"
            disabled={saving}
            className="h-8 min-w-0 flex-1 rounded-sm border border-ember bg-ink px-2 text-sm text-linen focus:outline-none"
          />
          <IconButton label="Save name" size="sm" type="submit" disabled={saving}>
            <Check className="size-4 text-moss" />
          </IconButton>
          <IconButton label="Cancel" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            <X className="size-4" />
          </IconButton>
        </div>
        {error ? <p className="px-1 text-xs text-rust">{error}</p> : null}
      </form>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-md transition-colors',
        active ? 'bg-soot-raised' : 'hover:bg-soot-raised/60'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left"
      >
        <span
          className={cn(
            'w-full truncate text-sm',
            active ? 'text-linen' : 'text-linen-dim group-hover:text-linen'
          )}
        >
          {conversation.title}
        </span>
        <span className="text-xs text-smoke">{formatRelativeTime(conversation.updatedAt)}</span>
      </button>

      <div ref={menuRef} className="relative pr-1">
        <IconButton
          label="Conversation options"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            (menuOpen || active) && 'opacity-100'
          )}
        >
          <MoreHorizontal className="size-4" />
        </IconButton>
        {menuOpen ? (
          <div
            role="menu"
            className="animate-rise-in absolute top-9 right-0 z-10 w-36 rounded-md border border-ash bg-soot py-1 shadow-lift"
          >
            <button
              type="button"
              role="menuitem"
              onClick={beginRename}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-linen-dim hover:bg-soot-raised hover:text-linen"
            >
              <Pencil className="size-3.5" /> Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-rust hover:bg-rust/10"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
