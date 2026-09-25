import type { User } from '@flare/contracts';
import { nowSeconds, toUser, type UserRow } from '../rows.js';

const USER_COLUMNS = 'id, display_name, created_at, updated_at';

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

  return (
    (await getUser(db, userId)) ?? {
      id: userId,
      displayName: defaultDisplayName,
      createdAt: now,
      updatedAt: now,
    }
  );
}

/** Upserts the display name and returns the resulting profile. */
export async function setUserDisplayName(
  db: D1Database,
  userId: string,
  displayName: string
): Promise<User> {
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`
    )
    .bind(userId, displayName, now, now)
    .run();

  const user = await getUser(db, userId);
  if (!user) {
    throw new Error(`User ${userId} vanished after upsert`);
  }
  return user;
}
