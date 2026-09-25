/**
 * Opaque keyset-pagination cursor for lists ordered by (updated_at DESC, id DESC).
 * Encoded as URL-safe base64 so it survives query strings untouched.
 */
export interface ConversationCursor {
  updatedAt: number;
  id: string;
}

export function encodeCursor(cursor: ConversationCursor): string {
  const json = JSON.stringify([cursor.updatedAt, cursor.id]);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(value: string): ConversationCursor | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'number' &&
      Number.isFinite(parsed[0]) &&
      typeof parsed[1] === 'string' &&
      parsed[1].length > 0
    ) {
      return { updatedAt: parsed[0], id: parsed[1] };
    }
    return null;
  } catch {
    return null;
  }
}
