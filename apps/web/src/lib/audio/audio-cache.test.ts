import { describe, expect, it } from 'vitest';
import { AudioCache } from './audio-cache';

describe('AudioCache', () => {
  const blob = (label: string) => new Blob([label], { type: 'audio/mpeg' });

  it('stores and retrieves by message id', () => {
    const cache = new AudioCache(3);
    cache.set('a', blob('a'));
    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')?.size).toBe(1);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry beyond the limit', () => {
    const cache = new AudioCache(2);
    cache.set('a', blob('a'));
    cache.set('b', blob('b'));
    cache.get('a'); // a becomes most recent
    cache.set('c', blob('c'));
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.size).toBe(2);
  });
});
