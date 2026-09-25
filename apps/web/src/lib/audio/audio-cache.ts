/**
 * In-memory cache of synthesized replies keyed by message id, so replaying a message never
 * re-synthesises it. Bounded to keep memory flat during long sessions.
 */
export class AudioCache {
  private readonly entries = new Map<string, Blob>();

  constructor(private readonly maxEntries = 40) {}

  get(messageId: string): Blob | undefined {
    const blob = this.entries.get(messageId);
    if (blob) {
      // Refresh recency.
      this.entries.delete(messageId);
      this.entries.set(messageId, blob);
    }
    return blob;
  }

  set(messageId: string, blob: Blob): void {
    this.entries.delete(messageId);
    this.entries.set(messageId, blob);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  has(messageId: string): boolean {
    return this.entries.has(messageId);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
