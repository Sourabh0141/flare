import type { Conversation } from '@flare/contracts';
import { decodeCursor, encodeCursor } from '../cursor.js';
import { newId, nowSeconds, toConversation, type ConversationRow } from '../rows.js';

const CONVERSATION_COLUMNS = 'id, user_id, title, created_at, updated_at';

export const DEFAULT_CONVERSATION_TITLE = 'New conversation';

export interface ListConversationsOptions {
  limit: number;
  cursor?: string | undefined;
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
  return { id, title, createdAt: now, updatedAt: now };
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

/** Keyset-paginated list ordered by most recent activity. */
export async function listConversations(
  db: D1Database,
  userId: string,
  options: ListConversationsOptions
): Promise<ConversationPage> {
  const limit = Math.max(1, options.limit);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;

  const statement = cursor
    ? db
        .prepare(
          `SELECT ${CONVERSATION_COLUMNS} FROM conversations
           WHERE user_id = ? AND (updated_at < ? OR (updated_at = ? AND id < ?))
           ORDER BY updated_at DESC, id DESC LIMIT ?`
        )
        .bind(userId, cursor.updatedAt, cursor.updatedAt, cursor.id, limit + 1)
    : db
        .prepare(
          `SELECT ${CONVERSATION_COLUMNS} FROM conversations
           WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT ?`
        )
        .bind(userId, limit + 1);

  const { results } = await statement.all<ConversationRow>();
  const rows = results ?? [];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  return { conversations: page.map(toConversation), nextCursor };
}

/** Returns true when a row was updated, false when it does not exist or is not owned by the user. */
export async function renameConversation(
  db: D1Database,
  conversationId: string,
  userId: string,
  title: string
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(title, nowSeconds(), conversationId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
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
