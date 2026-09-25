import {
  DEFAULT_PERSONA,
  DEFAULT_VOICE,
  isEmotion,
  isGesture,
  isPersonaId,
  isVoiceId,
  type Conversation,
  type InviteRequestRecord,
  type InviteStatus,
  type Message,
  type MessageRole,
  type User,
} from '@flare/contracts';

/**
 * Raw D1 row shapes. Column names are snake_case in SQLite; everything above the repository
 * layer works with the camelCase domain types from `@flare/contracts`.
 */

export interface UserRow {
  id: string;
  display_name: string;
  voice: string | null;
  persona: string | null;
  created_at: number;
  updated_at: number;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  pinned: number;
  archived: number;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  emotion: string | null;
  gesture: string | null;
  intensity: number | null;
  language: string | null;
  created_at: number;
}

export interface InviteRequestRow {
  id: string;
  name: string;
  email: string;
  reason: string;
  status: string;
  created_at: number;
  reviewed_at: number | null;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    // Unknown or retired ids fall back to defaults rather than breaking the client.
    voice: isVoiceId(row.voice) ? row.voice : DEFAULT_VOICE,
    persona: isPersonaId(row.persona) ? row.persona : DEFAULT_PERSONA,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    // Values written by older code or a future model revision degrade to "no expression"
    // instead of breaking the client.
    emotion: isEmotion(row.emotion) ? row.emotion : null,
    gesture: isGesture(row.gesture) ? row.gesture : null,
    intensity:
      typeof row.intensity === 'number' && Number.isFinite(row.intensity)
        ? Math.min(1, Math.max(0, row.intensity))
        : null,
    language: row.language,
    createdAt: row.created_at,
  };
}

const INVITE_STATUSES: readonly InviteStatus[] = ['pending', 'approved', 'dismissed'];

export function toInviteRequest(row: InviteRequestRow): InviteRequestRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    reason: row.reason,
    status: (INVITE_STATUSES as readonly string[]).includes(row.status)
      ? (row.status as InviteStatus)
      : 'pending',
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/** Current time as Unix epoch seconds, the unit every table stores. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function newId(): string {
  return crypto.randomUUID();
}
