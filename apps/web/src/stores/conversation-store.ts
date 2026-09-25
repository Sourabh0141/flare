import type { Conversation, Message } from '@flare/contracts';
import { create } from 'zustand';

export interface PendingTurn {
  /** The user's transcript while the reply is still being generated. */
  transcript: string;
  /** Flare's reply so far, growing as the stream arrives. */
  reply: string;
}

export interface ConversationStore {
  conversations: Conversation[];
  nextCursor: string | null;
  listStatus: 'idle' | 'loading' | 'ready' | 'error';
  listError: string | null;
  /** Archived conversations, loaded on demand. */
  archivedConversations: Conversation[];
  archivedStatus: 'idle' | 'loading' | 'ready' | 'error';

  activeId: string | null;
  messages: Message[];
  transcriptStatus: 'idle' | 'loading' | 'ready' | 'error';
  transcriptError: string | null;
  pendingTurn: PendingTurn | null;

  setList: (
    page: { conversations: Conversation[]; nextCursor: string | null },
    append: boolean
  ) => void;
  setListStatus: (status: ConversationStore['listStatus'], error?: string | null) => void;
  setArchived: (conversations: Conversation[]) => void;
  setArchivedStatus: (status: ConversationStore['archivedStatus']) => void;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;

  openConversation: (id: string | null) => void;
  setTranscript: (messages: Message[]) => void;
  setTranscriptStatus: (
    status: ConversationStore['transcriptStatus'],
    error?: string | null
  ) => void;
  appendMessages: (conversationId: string, messages: Message[]) => void;
  setPendingTurn: (pending: PendingTurn | null) => void;
  appendPendingReply: (text: string) => void;
  reset: () => void;
}

const initial = {
  conversations: [] as Conversation[],
  nextCursor: null,
  listStatus: 'idle' as const,
  listError: null,
  archivedConversations: [] as Conversation[],
  archivedStatus: 'idle' as const,
  activeId: null,
  messages: [] as Message[],
  transcriptStatus: 'idle' as const,
  transcriptError: null,
  pendingTurn: null,
};

/** Pinned first, then most recent; matches the server's ordering. */
export function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1)
  );
}

export const useConversationStore = create<ConversationStore>((set) => ({
  ...initial,

  setList: (page, append) =>
    set((prev) => ({
      conversations: sortConversations(
        append ? dedupe([...prev.conversations, ...page.conversations]) : page.conversations
      ),
      nextCursor: page.nextCursor,
      listStatus: 'ready',
      listError: null,
    })),
  setListStatus: (listStatus, listError = null) => set({ listStatus, listError }),
  setArchived: (archivedConversations) =>
    set({
      archivedConversations: sortConversations(archivedConversations),
      archivedStatus: 'ready',
    }),
  setArchivedStatus: (archivedStatus) => set({ archivedStatus }),
  upsertConversation: (conversation) =>
    set((prev) => {
      const active = prev.conversations.filter((c) => c.id !== conversation.id);
      const archived = prev.archivedConversations.filter((c) => c.id !== conversation.id);
      return conversation.archived
        ? {
            conversations: active,
            archivedConversations: sortConversations([conversation, ...archived]),
          }
        : {
            conversations: sortConversations([conversation, ...active]),
            archivedConversations: archived,
          };
    }),
  removeConversation: (id) =>
    set((prev) => ({
      conversations: prev.conversations.filter((c) => c.id !== id),
      archivedConversations: prev.archivedConversations.filter((c) => c.id !== id),
      ...(prev.activeId === id
        ? { activeId: null, messages: [], transcriptStatus: 'idle' as const, pendingTurn: null }
        : {}),
    })),

  openConversation: (id) =>
    set((prev) =>
      prev.activeId === id
        ? {}
        : {
            activeId: id,
            messages: [],
            transcriptStatus: id ? 'loading' : 'idle',
            transcriptError: null,
            pendingTurn: null,
          }
    ),
  setTranscript: (messages) => set({ messages, transcriptStatus: 'ready', transcriptError: null }),
  setTranscriptStatus: (transcriptStatus, transcriptError = null) =>
    set({ transcriptStatus, transcriptError }),
  appendMessages: (conversationId, incoming) =>
    set((prev) => ({
      activeId: conversationId,
      transcriptStatus: 'ready',
      messages:
        prev.activeId === conversationId ? dedupe([...prev.messages, ...incoming]) : incoming,
      pendingTurn: null,
    })),
  setPendingTurn: (pendingTurn) => set({ pendingTurn }),
  appendPendingReply: (text) =>
    set((prev) =>
      prev.pendingTurn
        ? { pendingTurn: { ...prev.pendingTurn, reply: prev.pendingTurn.reply + text } }
        : {}
    ),
  reset: () => set({ ...initial }),
}));

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
