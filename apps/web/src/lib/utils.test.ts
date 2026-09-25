import { describe, expect, it } from 'vitest';
import { cn, formatRelativeTime } from './utils';

describe('cn', () => {
  it('merges conflicting tailwind classes', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-25T12:00:00');
  const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

  it('describes recent times relative to now', () => {
    expect(formatRelativeTime(seconds(new Date('2026-09-25T11:59:30')), now)).toBe('Just now');
    expect(formatRelativeTime(seconds(new Date('2026-09-25T11:35:00')), now)).toBe('25m ago');
    expect(formatRelativeTime(seconds(new Date('2026-09-25T08:00:00')), now)).toBe('Today');
    expect(formatRelativeTime(seconds(new Date('2026-09-24T20:00:00')), now)).toBe('Yesterday');
  });

  it('falls back to dates, adding the year when it differs', () => {
    expect(formatRelativeTime(seconds(new Date('2026-09-15T12:00:00')), now)).toBe('Sep 15');
    expect(formatRelativeTime(seconds(new Date('2025-09-15T12:00:00')), now)).toBe('Sep 15, 2025');
    expect(formatRelativeTime(0, now)).toBe('');
  });
});
