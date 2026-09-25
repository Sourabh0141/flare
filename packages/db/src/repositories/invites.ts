import { newId, nowSeconds } from '../rows';

export interface InsertInviteRequestInput {
  name: string;
  email: string;
  reason: string;
  ipHash: string | null;
  userAgent: string | null;
}

/** Stores an invite request. Repeat submissions from the same email are kept; you review them. */
export async function insertInviteRequest(
  db: D1Database,
  input: InsertInviteRequestInput
): Promise<{ id: string; createdAt: number }> {
  const id = newId();
  const createdAt = nowSeconds();
  await db
    .prepare(
      `INSERT INTO invite_requests (id, name, email, reason, ip_hash, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, input.name, input.email, input.reason, input.ipHash, input.userAgent, createdAt)
    .run();
  return { id, createdAt };
}

/** Requests from one email in the last `windowSeconds`; used to cap repeat submissions. */
export async function countRecentInviteRequests(
  db: D1Database,
  email: string,
  windowSeconds: number
): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM invite_requests WHERE email = ? AND created_at >= ?')
    .bind(email, nowSeconds() - windowSeconds)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
