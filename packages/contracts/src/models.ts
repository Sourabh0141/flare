import { z } from 'zod';
import { emotionSchema, gestureSchema } from './character';
import { personaIdSchema, voiceIdSchema } from './voices';

export const MESSAGE_ROLES = ['user', 'assistant', 'summary'] as const;
export const messageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof messageRoleSchema>;

/** Unix epoch seconds. All timestamps in the API use this representation. */
const epochSeconds = z.number().int().nonnegative();

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  voice: voiceIdSchema,
  persona: personaIdSchema,
  createdAt: epochSeconds,
  updatedAt: epochSeconds,
});
export type User = z.infer<typeof userSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
  createdAt: epochSeconds,
  updatedAt: epochSeconds,
});
export type Conversation = z.infer<typeof conversationSchema>;

/** How strongly the character shows an emotion, 0 (barely) to 1 (fully). */
export const intensitySchema = z.number().min(0).max(1);

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  emotion: emotionSchema.nullable(),
  gesture: gestureSchema.nullable(),
  intensity: intensitySchema.nullable(),
  /** ISO 639-1 code the message was spoken in; null for summaries and older rows. */
  language: z.string().nullable(),
  createdAt: epochSeconds,
});
export type Message = z.infer<typeof messageSchema>;

export const INVITE_STATUSES = ['pending', 'approved', 'dismissed'] as const;
export const inviteStatusSchema = z.enum(INVITE_STATUSES);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

export const inviteRequestRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  reason: z.string(),
  status: inviteStatusSchema,
  createdAt: epochSeconds,
  reviewedAt: epochSeconds.nullable(),
});
export type InviteRequestRecord = z.infer<typeof inviteRequestRecordSchema>;
