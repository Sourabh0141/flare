'use client';

import { UserButton, useUser } from '@clerk/clerk-react';
import { Plus, Search, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useConversations } from '@/hooks/use-conversations';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Spinner } from '../ui/spinner';
import { Wordmark } from '../ui/wordmark';
import { ConversationRow } from './conversation-row';
import { DeleteConversationDialog } from './delete-conversation-dialog';

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Stops any in-flight turn before switching conversations. */
  onInterrupt: () => void;
}

export function Sidebar({ open, onClose, onInterrupt }: SidebarProps) {
  const { user } = useUser();
  const {
    loadList,
    loadMore,
    open: openConversation,
    startNew,
    rename,
    remove,
  } = useConversations();
  const conversations = useConversationStore((s) => s.conversations);
  const activeId = useConversationStore((s) => s.activeId);
  const listStatus = useConversationStore((s) => s.listStatus);
  const listError = useConversationStore((s) => s.listError);
  const nextCursor = useConversationStore((s) => s.nextCursor);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(needle));
  }, [conversations, query]);

  const select = (id: string) => {
    onInterrupt();
    void openConversation(id);
    onClose();
  };

  const handleNew = () => {
    onInterrupt();
    startNew();
    onClose();
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close conversations"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-deep/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        aria-label="Conversations"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[18rem] flex-col border-r border-ash/70 bg-soot/95 backdrop-blur-md transition-transform duration-300 ease-out-soft',
          'lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="rounded-md" aria-label="Flare home">
            <Wordmark />
          </Link>
          <IconButton label="Close conversations" size="sm" onClick={onClose} className="lg:hidden">
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="flex flex-col gap-2 px-3 pb-2">
          <Button variant="secondary" className="w-full justify-start" onClick={handleNew}>
            <Plus className="size-4" />
            New conversation
          </Button>
          {conversations.length > 4 ? (
            <label className="relative block">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-smoke"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="h-9 w-full rounded-md border border-ash bg-ink pr-3 pl-8 text-sm text-linen placeholder:text-smoke focus:border-ember focus:outline-none"
              />
            </label>
          ) : null}
        </div>

        <nav
          className="flex-1 scrollbar-thin overflow-y-auto px-2 py-1"
          aria-label="Conversation history"
        >
          {listStatus === 'loading' && conversations.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-6 text-sm text-smoke">
              <Spinner className="size-4" /> Loading
            </div>
          ) : listStatus === 'error' && conversations.length === 0 ? (
            <div className="flex flex-col gap-2 px-2 py-6 text-sm">
              <p className="text-rust">{listError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadList()}
                className="self-start"
              >
                Try again
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-6 text-sm text-smoke">
              Your conversations will appear here. Each one is named after what you talk about.
            </p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-6 text-sm text-smoke">No conversation matches that.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {visible.map((conversation) => (
                <li key={conversation.id}>
                  <ConversationRow
                    conversation={conversation}
                    active={conversation.id === activeId}
                    onSelect={() => select(conversation.id)}
                    onRename={(title) => rename(conversation.id, title)}
                    onDelete={() => setDeleting({ id: conversation.id, title: conversation.title })}
                  />
                </li>
              ))}
            </ul>
          )}
          {nextCursor && !query ? (
            <div className="px-2 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadMore()}
                loading={listStatus === 'loading'}
              >
                Show older
              </Button>
            </div>
          ) : null}
        </nav>

        <div className="flex items-center gap-3 border-t border-ash/70 px-4 py-3">
          <UserButton appearance={{ elements: { avatarBox: 'size-8 ring-1 ring-ash' } }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-linen">
              {user?.firstName || user?.username || 'You'}
            </p>
            <p className="truncate text-xs text-smoke">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <Link
            href="/settings/"
            aria-label="Settings"
            title="Settings"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-linen-dim transition-colors hover:bg-soot-raised hover:text-linen"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </aside>

      <DeleteConversationDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async (id) => {
          const error = await remove(id);
          if (!error) setDeleting(null);
          return error;
        }}
      />
    </>
  );
}
