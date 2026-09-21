'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  fetchConversations,
  fetchConversationDetails,
  renameConversation as apiRenameConversation,
  deleteConversation as apiDeleteConversation,
  type ConversationItem,
  type MessageItem,
} from '@/lib/api';

interface ConversationContextType {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  activeMessages: MessageItem[];
  isLoadingList: boolean;
  isLoadingConversation: boolean;
  error: string | null;
  refreshConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  renameConversation: (id: string, newTitle: string) => Promise<boolean>;
  deleteConversation: (id: string) => Promise<boolean>;
  updateAfterVoiceTurn: (conversationId: string, userTranscript: string, assistantResponse: string) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<MessageItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refreshes the list of conversations from the API Worker.
   */
  const refreshConversations = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      setIsLoadingList(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const list = await fetchConversations(token);
      setConversations(list);
    } catch (err: unknown) {
      console.error('Failed to fetch conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations.');
    } finally {
      setIsLoadingList(false);
    }
  }, [getToken, isSignedIn]);

  // Load conversations on initial authentication
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      refreshConversations();
    } else if (!isSignedIn) {
      setConversations([]);
      setActiveConversationId(null);
      setActiveMessages([]);
    }
  }, [isLoaded, isSignedIn, refreshConversations]);

  /**
   * Selects and loads a specific conversation.
   */
  const selectConversation = useCallback(
    async (id: string) => {
      if (activeConversationId === id) return;

      try {
        setIsLoadingConversation(true);
        setError(null);
        setActiveConversationId(id);

        const token = await getToken();
        if (!token) return;

        const details = await fetchConversationDetails(token, id);
        setActiveMessages(details.messages || []);
      } catch (err: unknown) {
        console.error(`Failed to load conversation ${id}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load conversation.');
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [activeConversationId, getToken]
  );

  /**
   * Clears the active conversation to start a new chat.
   */
  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveMessages([]);
  }, []);

  /**
   * Renames a conversation title.
   */
  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<boolean> => {
      try {
        const token = await getToken();
        if (!token) return false;

        const updated = await apiRenameConversation(token, id, newTitle);

        // Optimistic state update
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: updated.title, updated_at: updated.updated_at } : c))
        );
        return true;
      } catch (err: unknown) {
        console.error(`Failed to rename conversation ${id}:`, err);
        return false;
      }
    },
    [getToken]
  );

  /**
   * Deletes a conversation and removes it from the list.
   */
  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const token = await getToken();
        if (!token) return false;

        await apiDeleteConversation(token, id);

        // Remove from list
        setConversations((prev) => prev.filter((c) => c.id !== id));

        // If active conversation was deleted, reset to new conversation
        if (activeConversationId === id) {
          startNewConversation();
        }
        return true;
      } catch (err: unknown) {
        console.error(`Failed to delete conversation ${id}:`, err);
        return false;
      }
    },
    [activeConversationId, getToken, startNewConversation]
  );

  /**
   * Updates state after a voice turn finishes in Unit 9.
   */
  const updateAfterVoiceTurn = useCallback(
    (conversationId: string, userTranscript: string, assistantResponse: string) => {
      setActiveConversationId(conversationId);
      const now = Math.floor(Date.now() / 1000);

      const userMsg: MessageItem = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: 'user',
        content: userTranscript,
        created_at: now,
      };

      const assistantMsg: MessageItem = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse,
        created_at: now,
      };

      setActiveMessages((prev) => [...prev, userMsg, assistantMsg]);
      refreshConversations();
    },
    [refreshConversations]
  );

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeMessages,
        isLoadingList,
        isLoadingConversation,
        error,
        refreshConversations,
        selectConversation,
        startNewConversation,
        renameConversation,
        deleteConversation,
        updateAfterVoiceTurn,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }
  return context;
}
