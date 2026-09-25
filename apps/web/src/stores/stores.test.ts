import type { Conversation, Message } from '@flare/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAssistantStore } from './assistant-store';
import { useConversationStore } from './conversation-store';

const conversation = (id: string, updatedAt: number): Conversation => ({
  id,
  title: `Conversation ${id}`,
  pinned: false,
  archived: false,
  createdAt: updatedAt,
  updatedAt,
});

const message = (id: string, conversationId: string, role: Message['role'] = 'user'): Message => ({
  id,
  conversationId,
  role,
  content: `message ${id}`,
  emotion: null,
  gesture: null,
  intensity: null,
  language: null,
  createdAt: 1,
});

describe('assistant store', () => {
  beforeEach(() => useAssistantStore.getState().reset());

  it('bumps the gesture sequence on every expression so repeats replay', () => {
    const store = useAssistantStore.getState();
    store.express('happy', 'nod');
    store.express('happy', 'nod');
    expect(useAssistantStore.getState().gestureSeq).toBe(2);
    expect(useAssistantStore.getState().emotion).toBe('happy');
  });

  it('relaxes back to neutral', () => {
    useAssistantStore.getState().express('annoyed', 'shake');
    useAssistantStore.getState().relax();
    expect(useAssistantStore.getState()).toMatchObject({ emotion: 'neutral', gesture: 'none' });
  });
});

describe('conversation store', () => {
  beforeEach(() => useConversationStore.getState().reset());

  it('keeps the list sorted by recency after an upsert', () => {
    const store = useConversationStore.getState();
    store.setList(
      { conversations: [conversation('a', 10), conversation('b', 5)], nextCursor: null },
      false
    );
    store.upsertConversation({ ...conversation('b', 20), title: 'Renamed' });
    const titles = useConversationStore.getState().conversations.map((c) => c.title);
    expect(titles).toEqual(['Renamed', 'Conversation a']);
  });

  it('appends pages without duplicates', () => {
    const store = useConversationStore.getState();
    store.setList({ conversations: [conversation('a', 10)], nextCursor: 'c1' }, false);
    store.setList(
      { conversations: [conversation('a', 10), conversation('b', 5)], nextCursor: null },
      true
    );
    expect(useConversationStore.getState().conversations).toHaveLength(2);
    expect(useConversationStore.getState().nextCursor).toBeNull();
  });

  it('switches transcript context when a turn lands in a new conversation', () => {
    const store = useConversationStore.getState();
    store.openConversation('old');
    store.setTranscript([message('1', 'old')]);
    store.setPendingTurn({ transcript: 'hi', reply: '' });
    store.appendMessages('new', [message('2', 'new'), message('3', 'new', 'assistant')]);
    const state = useConversationStore.getState();
    expect(state.activeId).toBe('new');
    expect(state.messages.map((m) => m.id)).toEqual(['2', '3']);
    expect(state.pendingTurn).toBeNull();
  });

  it('clears the active transcript when that conversation is deleted', () => {
    const store = useConversationStore.getState();
    store.setList({ conversations: [conversation('a', 1)], nextCursor: null }, false);
    store.openConversation('a');
    store.setTranscript([message('1', 'a')]);
    store.removeConversation('a');
    const state = useConversationStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.activeId).toBeNull();
    expect(state.messages).toHaveLength(0);
  });
});
