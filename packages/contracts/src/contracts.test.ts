import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  LIMITS,
  isEmotion,
  isGesture,
  listConversationsQuerySchema,
  respondRequestSchema,
  updateSettingsRequestSchema,
} from './index.js';

describe('character enums', () => {
  it('recognises known emotions and gestures only', () => {
    expect(isEmotion('happy')).toBe(true);
    expect(isEmotion('ecstatic')).toBe(false);
    expect(isGesture('nod')).toBe(true);
    expect(isGesture('backflip')).toBe(false);
  });
});

describe('error codes', () => {
  it('maps every code to an HTTP status', () => {
    for (const code of API_ERROR_CODES) {
      expect(API_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('request schemas', () => {
  it('trims and bounds display names', () => {
    expect(updateSettingsRequestSchema.parse({ displayName: '  Ada ' }).displayName).toBe('Ada');
    expect(updateSettingsRequestSchema.safeParse({ displayName: '   ' }).success).toBe(false);
    expect(
      updateSettingsRequestSchema.safeParse({ displayName: 'x'.repeat(LIMITS.displayNameMax + 1) })
        .success
    ).toBe(false);
  });

  it('coerces and defaults the conversations page size', () => {
    expect(listConversationsQuerySchema.parse({}).limit).toBe(LIMITS.conversationsPageDefault);
    expect(listConversationsQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(listConversationsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('requires a non-empty transcript for a respond request', () => {
    expect(respondRequestSchema.safeParse({ transcript: '' }).success).toBe(false);
    expect(respondRequestSchema.parse({ transcript: ' hi ' })).toEqual({ transcript: 'hi' });
  });
});
