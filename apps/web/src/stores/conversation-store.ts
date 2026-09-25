import type { Conversation, Message } from '@flare/contracts';
import { create } from 'zustand';

export interface PendingTurn {
  /** The user's transcript while the reply is still being generated. */
  transcript: string;
}

export interface ConversationStore {
  conversations: Conversation[];
  nextCursor: string | null;
  listStatus: 'idle' | 'loading' | 'ready' | 'error';
  listError: string | null;

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
  reset: () => void;
}

const initial = {
  conversations: [] as Conversation[],
  nextCursor: null,
  listStatus: 'idle' as const,
  listError: null,
  activeId: null,
  messages: [] as Message[],
  transcriptStatus: 'idle' as const,
  transcriptError: null,
  pendingTurn: null,
};

function sortByRecency(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1));
}

export const useConversationStore = create<ConversationStore>((set) => ({
  ...initial,

  setList: (page, append) =>
    set((prev) => ({
      conversations: append
        ? dedupe([...prev.conversations, ...page.conversations])
        : page.conversations,
      nextCursor: page.nextCursor,
      listStatus: 'ready',
      listError: null,
    })),
  setListStatus: (listStatus, listError = null) => set({ listStatus, listError }),
  upsertConversation: (conversation) =>
    set((prev) => ({
      conversations: sortByRecency([
        conversation,
        ...prev.conversations.filter((c) => c.id !== conversation.id),
      ]),
    })),
  removeConversation: (id) =>
    set((prev) => ({
      conversations: prev.conversations.filter((c) => c.id !== id),
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
