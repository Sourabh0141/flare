import type { Conversation } from '@flare/contracts';
import { decodeCursor, encodeCursor } from '../cursor';
import { newId, nowSeconds, toConversation, type ConversationRow } from '../rows';

const CONVERSATION_COLUMNS = 'id, user_id, title, pinned, archived, created_at, updated_at';

export const DEFAULT_CONVERSATION_TITLE = 'New conversation';

export interface ListConversationsOptions {
  limit: number;
  cursor?: string | undefined;
  /** Default false: active conversations only. */
  archived?: boolean | undefined;
}

export interface ConversationPage {
  conversations: Conversation[];
  nextCursor: string | null;
}

export async function createConversation(
  db: D1Database,
  userId: string,
  title: string = DEFAULT_CONVERSATION_TITLE
): Promise<Conversation> {
  const id = newId();
  const now = nowSeconds();
  await db
    .prepare(
      'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, userId, title, now, now)
    .run();
  return { id, title, pinned: false, archived: false, createdAt: now, updatedAt: now };
}

/** Fetches a conversation only if it belongs to `userId`; ownership is part of the query. */
export async function getConversation(
  db: D1Database,
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const row = await db
    .prepare(`SELECT ${CONVERSATION_COLUMNS} FROM conversations WHERE id = ? AND user_id = ?`)
    .bind(conversationId, userId)
    .first<ConversationRow>();
  return row ? toConversation(row) : null;
}

/** Keyset-paginated list: pinned first, then most recent activity. */
export async function listConversations(
  db: D1Database,
  userId: string,
  options: ListConversationsOptions
): Promise<ConversationPage> {
  const limit = Math.max(1, options.limit);
  const archived = options.archived ? 1 : 0;
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;

  const statement = cursor
    ? db
        .prepare(
          `SELECT ${CONVERSATION_COLUMNS} FROM conversations
           WHERE user_id = ? AND archived = ?
             AND (pinned < ? OR (pinned = ? AND (updated_at < ? OR (updated_at = ? AND id < ?))))
           ORDER BY pinned DESC, updated_at DESC, id DESC LIMIT ?`
        )
        .bind(
          userId,
          archived,
          cursor.pinned ? 1 : 0,
          cursor.pinned ? 1 : 0,
          cursor.updatedAt,
          cursor.updatedAt,
          cursor.id,
          limit + 1
        )
    : db
        .prepare(
          `SELECT ${CONVERSATION_COLUMNS} FROM conversations
           WHERE user_id = ? AND archived = ?
           ORDER BY pinned DESC, updated_at DESC, id DESC LIMIT ?`
        )
        .bind(userId, archived, limit + 1);

  const { results } = await statement.all<ConversationRow>();
  const rows = results ?? [];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({ pinned: last.pinned === 1, updatedAt: last.updated_at, id: last.id })
      : null;

  return { conversations: page.map(toConversation), nextCursor };
}

export interface ConversationChanges {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
}

/**
 * Applies the given changes. Renaming bumps `updated_at`; pinning and archiving do not, so
 * the list order still reflects when the conversation was last used.
 */
export async function updateConversation(
  db: D1Database,
  conversationId: string,
  userId: string,
  changes: ConversationChanges
): Promise<Conversation | null> {
  const current = await getConversation(db, conversationId, userId);
  if (!current) return null;

  const title = changes.title ?? current.title;
  const pinned = changes.pinned ?? current.pinned;
  const archived = changes.archived ?? current.archived;
  const updatedAt = changes.title !== undefined ? nowSeconds() : current.updatedAt;

  await db
    .prepare(
      'UPDATE conversations SET title = ?, pinned = ?, archived = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    )
    .bind(title, pinned ? 1 : 0, archived ? 1 : 0, updatedAt, conversationId, userId)
    .run();

  return { ...current, title, pinned, archived, updatedAt };
}

/** Sets the title without bumping `updated_at`; used for auto-generated titles. */
export async function setGeneratedTitle(
  db: D1Database,
  conversationId: string,
  userId: string,
  title: string
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?')
    .bind(title, conversationId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Deletes the conversation; messages cascade via the foreign key. */
export async function deleteConversation(
  db: D1Database,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .bind(conversationId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** True when the conversation has been idle for longer than `thresholdSeconds`. */
export function isConversationStale(
  conversation: Pick<Conversation, 'updatedAt'>,
  thresholdSeconds: number,
  now: number = nowSeconds()
): boolean {
  return now - conversation.updatedAt > thresholdSeconds;
}
