'use client';

import { useCallback, useEffect, useRef } from 'react';
import { describeError } from '@/lib/api/client';
import { useConversationStore } from '@/stores/conversation-store';
import { useApiClient } from './use-api-client';

/**
 * Data actions for the sidebar and transcript. State lives in the conversation store;
 * this hook owns the API calls and their loading and error transitions.
 */
export function useConversations() {
  const api = useApiClient();
  const store = useConversationStore;
  const openRequest = useRef<AbortController | null>(null);

  const loadList = useCallback(async () => {
    const { setListStatus, setList } = store.getState();
    setListStatus('loading');
    try {
      const page = await api.listConversations({ limit: 50 });
      setList(page, false);
    } catch (error) {
      setListStatus('error', describeError(error));
    }
  }, [api, store]);

  const loadMore = useCallback(async () => {
    const { nextCursor, listStatus, setList, setListStatus } = store.getState();
    if (!nextCursor || listStatus === 'loading') return;
    setListStatus('loading');
    try {
      const page = await api.listConversations({ limit: 50, cursor: nextCursor });
      setList(page, true);
    } catch (error) {
      setListStatus('error', describeError(error));
    }
  }, [api, store]);

  const loadArchived = useCallback(async () => {
    const { setArchived, setArchivedStatus } = store.getState();
    setArchivedStatus('loading');
    try {
      const page = await api.listConversations({ limit: 100, archived: true });
      setArchived(page.conversations);
    } catch {
      setArchivedStatus('error');
    }
  }, [api, store]);

  const open = useCallback(
    async (id: string) => {
      const state = store.getState();
      if (state.activeId === id && state.transcriptStatus === 'ready') return;
      openRequest.current?.abort();
      const controller = new AbortController();
      openRequest.current = controller;

      state.openConversation(id);
      try {
        const detail = await api.getConversation(id, controller.signal);
        if (controller.signal.aborted) return;
        store.getState().setTranscript(detail.messages);
        store.getState().upsertConversation(detail.conversation);
      } catch (error) {
        if (controller.signal.aborted) return;
        store.getState().setTranscriptStatus('error', describeError(error));
      }
    },
    [api, store]
  );

  const startNew = useCallback(() => {
    openRequest.current?.abort();
    store.getState().openConversation(null);
  }, [store]);

  const update = useCallback(
    async (
      id: string,
      changes: { title?: string; pinned?: boolean; archived?: boolean }
    ): Promise<string | null> => {
      try {
        const updated = await api.updateConversation(id, changes);
        store.getState().upsertConversation(updated);
        return null;
      } catch (error) {
        return describeError(error);
      }
    },
    [api, store]
  );

  const rename = useCallback((id: string, title: string) => update(id, { title }), [update]);
  const setPinned = useCallback((id: string, pinned: boolean) => update(id, { pinned }), [update]);
  const setArchived = useCallback(
    (id: string, archived: boolean) => update(id, { archived }),
    [update]
  );

  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        await api.deleteConversation(id);
        store.getState().removeConversation(id);
        return null;
      } catch (error) {
        return describeError(error);
      }
    },
    [api, store]
  );

  useEffect(() => () => openRequest.current?.abort(), []);

  return {
    loadList,
    loadMore,
    loadArchived,
    open,
    startNew,
    rename,
    setPinned,
    setArchived,
    remove,
  };
}
