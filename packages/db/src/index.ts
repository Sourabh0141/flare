/**
 * @flare/db - Typed D1 Database Access Layer
 */

import type {
  User,
  Conversation,
  Message,
  MessageRole,
  CreateConversationParams,
  InsertMessageParams,
  ConversationContext,
} from './types.js';

export * from './types.js';

// =============================================================================
// User Repository Functions
// =============================================================================

/**
 * Retrieves a user by their Clerk ID, or creates a new user profile if one does not exist.
 */
export async function getOrCreateUser(
  db: D1Database,
  userId: string,
  defaultDisplayName: string = 'User'
): Promise<User> {
  const existingUser = await db
    .prepare('SELECT id, display_name, created_at, updated_at FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();

  if (existingUser) {
    return existingUser;
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      'INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    .bind(userId, defaultDisplayName, now, now)
    .run();

  return {
    id: userId,
    display_name: defaultDisplayName,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Retrieves a user profile by ID.
 */
export async function getUser(db: D1Database, userId: string): Promise<User | null> {
  return await db
    .prepare('SELECT id, display_name, created_at, updated_at FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();
}

/**
 * Updates a user's display name in settings.
 */
export async function updateUserDisplayName(
  db: D1Database,
  userId: string,
  displayName: string
): Promise<User | null> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      'UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?'
    )
    .bind(displayName, now, userId)
    .run();

  if (result.meta.changes === 0) {
    return null;
  }

  return await getUser(db, userId);
}

// =============================================================================
// Conversation Repository Functions
// =============================================================================

/**
 * Creates a new conversation thread for an authenticated user.
 */
export async function createConversation(
  db: D1Database,
  params: CreateConversationParams
): Promise<Conversation> {
  const id = params.id || crypto.randomUUID();
  const title = params.title || 'New conversation';
  const now = Math.floor(Date.now() / 1000);

  // Ensure parent user record exists
  await getOrCreateUser(db, params.userId);

  await db
    .prepare(
      'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, params.userId, title, now, now)
    .run();

  return {
    id,
    user_id: params.userId,
    title,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Retrieves a single conversation by ID, optionally verifying user ownership.
 */
export async function getConversation(
  db: D1Database,
  conversationId: string,
  userId?: string
): Promise<Conversation | null> {
  if (userId) {
    return await db
      .prepare(
        'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?'
      )
      .bind(conversationId, userId)
      .first<Conversation>();
  }

  return await db
    .prepare(
      'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?'
    )
    .bind(conversationId)
    .first<Conversation>();
}

/**
 * Lists all conversations belonging to a user, ordered by most recent activity.
 */
export async function listConversations(
  db: D1Database,
  userId: string,
  limit: number = 50
): Promise<Conversation[]> {
  const queryResult = await db
    .prepare(
      'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?'
    )
    .bind(userId, limit)
    .all<Conversation>();

  return queryResult.results || [];
}

/**
 * Renames a conversation title.
 */
export async function updateConversationTitle(
  db: D1Database,
  conversationId: string,
  userId: string,
  title: string
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    )
    .bind(title, now, conversationId, userId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * Touches the updated_at timestamp of a conversation on every turn.
 */
export async function touchConversation(
  db: D1Database,
  conversationId: string
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
    .bind(now, conversationId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * Deletes a conversation and all its associated messages via ON DELETE CASCADE.
 */
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

/**
 * Checks whether a conversation has been inactive for longer than the specified threshold
 */
export async function isConversationInactive(
  db: D1Database,
  conversationId: string,
  thresholdMinutes: number = 30
): Promise<boolean> {
  const conv = await db
    .prepare('SELECT updated_at FROM conversations WHERE id = ?')
    .bind(conversationId)
    .first<{ updated_at: number }>();

  if (!conv) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsedSeconds = now - conv.updated_at;
  return elapsedSeconds > thresholdMinutes * 60;
}

// =============================================================================
// Message & Context Repository Functions
// =============================================================================

/**
 * Inserts a new user transcript, assistant response, or summary message.
 */
export async function insertMessage(
  db: D1Database,
  params: InsertMessageParams
): Promise<Message> {
  const id = params.id || crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Use batch to insert the message and update the conversation timestamp atomically
  const insertStmt = db
    .prepare(
      'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, params.conversationId, params.role, params.content, now);

  const touchStmt = db
    .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
    .bind(now, params.conversationId);

  await db.batch([insertStmt, touchStmt]);

  return {
    id,
    conversation_id: params.conversationId,
    role: params.role,
    content: params.content,
    created_at: now,
  };
}

/**
 * Retrieves all messages in chronological order for a conversation.
 */
export async function getConversationMessages(
  db: D1Database,
  conversationId: string
): Promise<Message[]> {
  const queryResult = await db
    .prepare(
      'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    )
    .bind(conversationId)
    .all<Message>();

  return queryResult.results || [];
}

/**
 * Builds the LLM context window: active synthetic summary first (if present),
 * followed by chronological non-summary messages.
 */
export async function getConversationContext(
  db: D1Database,
  conversationId: string,
  limit: number = 30
): Promise<ConversationContext> {
  // 1. Fetch the latest summary message if one exists
  const summary = await db
    .prepare(
      "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? AND role = 'summary' ORDER BY created_at DESC LIMIT 1"
    )
    .bind(conversationId)
    .first<Message>();

  // 2. Fetch remaining non-summary messages in chronological order
  const messagesResult = await db
    .prepare(
      "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? AND role != 'summary' ORDER BY created_at ASC LIMIT ?"
    )
    .bind(conversationId, limit)
    .all<Message>();

  return {
    summary: summary || null,
    messages: messagesResult.results || [],
  };
}

/**
 * Counts the number of active non-summary messages in a conversation
 * (Used to trigger background summarization at >= 20 messages).
 */
export async function countNonSummaryMessages(
  db: D1Database,
  conversationId: string
): Promise<number> {
  const result = await db
    .prepare(
      "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role != 'summary'"
    )
    .bind(conversationId)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Retrieves the oldest N non-summary messages to prepare for LLM summarization.
 */
export async function getOldestNonSummaryMessages(
  db: D1Database,
  conversationId: string,
  limit: number = 10
): Promise<Message[]> {
  const queryResult = await db
    .prepare(
      "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? AND role != 'summary' ORDER BY created_at ASC LIMIT ?"
    )
    .bind(conversationId, limit)
    .all<Message>();

  return queryResult.results || [];
}

/**
 * Atomically inserts a synthetic summary message and deletes the summarized messages
 * using D1's native transaction batch API.
 */
export async function applyConversationSummary(
  db: D1Database,
  conversationId: string,
  summaryContent: string,
  messageIdsToDelete: string[]
): Promise<Message> {
  const summaryId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const statements: D1PreparedStatement[] = [];

  // 1. Insert new summary message
  statements.push(
    db
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(summaryId, conversationId, 'summary' as MessageRole, summaryContent, now)
  );

  // 2. Delete summarized message rows
  for (const msgId of messageIdsToDelete) {
    statements.push(
      db.prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?').bind(msgId, conversationId)
    );
  }

  // 3. Touch conversation timestamp
  statements.push(
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').bind(now, conversationId)
  );

  // Execute atomically
  await db.batch(statements);

  return {
    id: summaryId,
    conversation_id: conversationId,
    role: 'summary',
    content: summaryContent,
    created_at: now,
  };
}
