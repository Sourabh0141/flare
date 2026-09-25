/**
 * Opaque keyset-pagination cursor for conversation lists ordered by
 * (pinned DESC, updated_at DESC, id DESC). Encoded as URL-safe base64 so it survives query
 * strings untouched.
 */
export interface ConversationCursor {
  pinned: boolean;
  updatedAt: number;
  id: string;
}

export function encodeCursor(cursor: ConversationCursor): string {
  const json = JSON.stringify([cursor.pinned ? 1 : 0, cursor.updatedAt, cursor.id]);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(value: string): ConversationCursor | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      (parsed[0] === 0 || parsed[0] === 1) &&
      typeof parsed[1] === 'number' &&
      Number.isFinite(parsed[1]) &&
      typeof parsed[2] === 'string' &&
      parsed[2].length > 0
    ) {
      return { pinned: parsed[0] === 1, updatedAt: parsed[1], id: parsed[2] };
    }
    return null;
  } catch {
    return null;
  }
}
