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
  createdAt: epochSeconds,
  updatedAt: epochSeconds,
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  emotion: emotionSchema.nullable(),
  gesture: gestureSchema.nullable(),
  createdAt: epochSeconds,
});
export type Message = z.infer<typeof messageSchema>;
