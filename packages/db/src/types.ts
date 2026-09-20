/**
 * Domain Models and Type Definitions for @flare/db
 */

export type MessageRole = 'user' | 'assistant' | 'summary';

export interface User {
  id: string;
  display_name: string;
  created_at: number;
  updated_at: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface ConversationWithMetadata extends Conversation {
  message_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
}

export interface CreateConversationParams {
  id?: string;
  userId: string;
  title?: string;
}

export interface InsertMessageParams {
  id?: string;
  conversationId: string;
  role: MessageRole;
  content: string;
}

export interface ConversationContext {
  summary: Message | null;
  messages: Message[];
}
