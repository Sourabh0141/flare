import type { InviteRequestRecord, InviteStatus } from '@flare/contracts';
import { newId, nowSeconds, toInviteRequest, type InviteRequestRow } from '../rows';

const INVITE_COLUMNS = 'id, name, email, reason, status, created_at, reviewed_at';

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

/** Newest first, for the admin review page. */
export async function listInviteRequests(
  db: D1Database,
  status: InviteStatus,
  limit: number
): Promise<InviteRequestRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT ${INVITE_COLUMNS} FROM invite_requests WHERE status = ?
       ORDER BY created_at DESC, rowid DESC LIMIT ?`
    )
    .bind(status, limit)
    .all<InviteRequestRow>();
  return (results ?? []).map(toInviteRequest);
}

export async function countInviteRequestsByStatus(
  db: D1Database
): Promise<Record<InviteStatus, number>> {
  const { results } = await db
    .prepare('SELECT status, COUNT(*) AS count FROM invite_requests GROUP BY status')
    .all<{ status: string; count: number }>();
  const counts: Record<InviteStatus, number> = { pending: 0, approved: 0, dismissed: 0 };
  for (const row of results ?? []) {
    if (row.status in counts) counts[row.status as InviteStatus] = row.count;
  }
  return counts;
}

export async function getInviteRequest(
  db: D1Database,
  id: string
): Promise<InviteRequestRecord | null> {
  const row = await db
    .prepare(`SELECT ${INVITE_COLUMNS} FROM invite_requests WHERE id = ?`)
    .bind(id)
    .first<InviteRequestRow>();
  return row ? toInviteRequest(row) : null;
}

export async function setInviteRequestStatus(
  db: D1Database,
  id: string,
  status: InviteStatus
): Promise<InviteRequestRecord | null> {
  await db
    .prepare('UPDATE invite_requests SET status = ?, reviewed_at = ? WHERE id = ?')
    .bind(status, nowSeconds(), id)
    .run();
  return getInviteRequest(db, id);
}
