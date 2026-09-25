import type { PersonaId, User, VoiceId } from '@flare/contracts';
import { nowSeconds, toUser, type UserRow } from '../rows';

const USER_COLUMNS = 'id, display_name, voice, persona, created_at, updated_at';

export async function getUser(db: D1Database, userId: string): Promise<User | null> {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(userId)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

/**
 * Returns the user's profile, creating it on first contact. Insertion is idempotent so two
 * concurrent first requests cannot fail on the primary key.
 */
export async function getOrCreateUser(
  db: D1Database,
  userId: string,
  defaultDisplayName = 'Friend'
): Promise<User> {
  const existing = await getUser(db, userId);
  if (existing) return existing;

  const now = nowSeconds();
  await db
    .prepare(
      'INSERT OR IGNORE INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    .bind(userId, defaultDisplayName, now, now)
    .run();

  const created = await getUser(db, userId);
  if (!created) {
    throw new Error(`User ${userId} vanished after insert`);
  }
  return created;
}

export interface UserPreferences {
  displayName?: string;
  voice?: VoiceId;
  persona?: PersonaId;
}

/** Applies the given preferences (only the provided ones) and returns the profile. */
export async function updateUserPreferences(
  db: D1Database,
  userId: string,
  prefs: UserPreferences
): Promise<User> {
  const current = await getOrCreateUser(db, userId);
  const now = nowSeconds();
  await db
    .prepare(
      'UPDATE users SET display_name = ?, voice = ?, persona = ?, updated_at = ? WHERE id = ?'
    )
    .bind(
      prefs.displayName ?? current.displayName,
      prefs.voice ?? current.voice,
      prefs.persona ?? current.persona,
      now,
      userId
    )
    .run();

  const user = await getUser(db, userId);
  if (!user) {
    throw new Error(`User ${userId} vanished after update`);
  }
  return user;
}

/** Removes the user and, through foreign keys, every conversation and message they own. */
export async function deleteUser(db: D1Database, userId: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Number of user turns since `sinceEpochSeconds`, across all of the user's conversations. */
export async function countUserTurnsSince(
  db: D1Database,
  userId: string,
  sinceEpochSeconds: number
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= ?`
    )
    .bind(userId, sinceEpochSeconds)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
