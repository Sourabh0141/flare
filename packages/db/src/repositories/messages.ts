import type { Emotion, Gesture, Message } from '@flare/contracts';
import { newId, nowSeconds, toMessage, type MessageRow } from '../rows';

const MESSAGE_COLUMNS =
  'id, conversation_id, role, content, emotion, gesture, intensity, language, created_at';

export interface InsertMessageInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: Emotion | null;
  gesture?: Gesture | null;
  intensity?: number | null;
  language?: string | null;
  /** Explicit timestamp so a user message and its reply keep their relative order. */
  createdAt?: number;
}

/** Inserts a message and bumps the parent conversation's activity timestamp atomically. */
export async function insertMessage(db: D1Database, input: InsertMessageInput): Promise<Message> {
  const id = newId();
  const createdAt = input.createdAt ?? nowSeconds();
  const emotion = input.emotion ?? null;
  const gesture = input.gesture ?? null;
  const intensity = input.intensity ?? null;
  const language = input.language ?? null;

  await db.batch([
    db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, emotion, gesture, intensity, language, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.conversationId,
        input.role,
        input.content,
        emotion,
        gesture,
        intensity,
        language,
        createdAt
      ),
    db
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .bind(createdAt, input.conversationId),
  ]);

  return {
    id,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    emotion,
    gesture,
    intensity,
    language,
    createdAt,
  };
}

/** Full transcript for display, oldest first, summaries included. */
export async function listMessages(db: D1Database, conversationId: string): Promise<Message[]> {
  const { results } = await db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`
    )
    .bind(conversationId)
    .all<MessageRow>();
  return (results ?? []).map(toMessage);
}

/** Fetches a single message, enforcing ownership through the parent conversation. */
export async function getOwnedMessage(
  db: D1Database,
  messageId: string,
  userId: string
): Promise<Message | null> {
  const row = await db
    .prepare(
      `SELECT m.id, m.conversation_id, m.role, m.content, m.emotion, m.gesture, m.intensity, m.language, m.created_at
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = ? AND c.user_id = ?`
    )
    .bind(messageId, userId)
    .first<MessageRow>();
  return row ? toMessage(row) : null;
}

export interface ConversationContext {
  /** The latest rolling summary, if the conversation has been compacted. */
  summary: Message | null;
  /** Live (non-summary) messages, oldest first. */
  messages: Message[];
}

/**
 * Context window for the LLM: the latest summary plus the most recent `limit` live messages,
 * returned in chronological order.
 */
export async function getConversationContext(
  db: D1Database,
  conversationId: string,
  limit = 30
): Promise<ConversationContext> {
  const [summaryResult, recentResult] = await db.batch<MessageRow>([
    db
      .prepare(
        `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE conversation_id = ? AND role = 'summary'
         ORDER BY created_at DESC, rowid DESC LIMIT 1`
      )
      .bind(conversationId),
    db
      .prepare(
        `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE conversation_id = ? AND role != 'summary'
         ORDER BY created_at DESC, rowid DESC LIMIT ?`
      )
      .bind(conversationId, limit),
  ]);

  const summaryRow = summaryResult?.results?.[0];
  const recentRows = recentResult?.results ?? [];

  return {
    summary: summaryRow ? toMessage(summaryRow) : null,
    messages: recentRows.reverse().map(toMessage),
  };
}

export async function countLiveMessages(db: D1Database, conversationId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ? AND role != 'summary'"
    )
    .bind(conversationId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getOldestLiveMessages(
  db: D1Database,
  conversationId: string,
  limit: number
): Promise<Message[]> {
  const { results } = await db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE conversation_id = ? AND role != 'summary'
       ORDER BY created_at ASC, rowid ASC LIMIT ?`
    )
    .bind(conversationId, limit)
    .all<MessageRow>();
  return (results ?? []).map(toMessage);
}

/**
 * Replaces a batch of old messages (and any prior summary) with a single new summary row in
 * one atomic batch. The summary is timestamped just before the oldest surviving message so
 * chronological reads keep it first.
 */
export async function replaceWithSummary(
  db: D1Database,
  conversationId: string,
  summaryContent: string,
  messageIdsToDelete: string[]
): Promise<void> {
  const oldest = await db
    .prepare(
      "SELECT MIN(created_at) AS created_at FROM messages WHERE conversation_id = ? AND role != 'summary'"
    )
    .bind(conversationId)
    .first<{ created_at: number | null }>();
  const anchor = oldest?.created_at ?? nowSeconds();

  const statements: D1PreparedStatement[] = [
    db
      .prepare("DELETE FROM messages WHERE conversation_id = ? AND role = 'summary'")
      .bind(conversationId),
    ...messageIdsToDelete.map((id) =>
      db
        .prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?')
        .bind(id, conversationId)
    ),
    db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, emotion, gesture, intensity, language, created_at)
         VALUES (?, ?, 'summary', ?, NULL, NULL, NULL, NULL, ?)`
      )
      .bind(newId(), conversationId, summaryContent, anchor),
  ];

  await db.batch(statements);
}
