import { z } from 'zod';
import { conversationSchema, messageSchema, userSchema } from './models';
import { personaIdSchema, voiceIdSchema } from './voices';

// -----------------------------------------------------------------------------
// Limits shared by client-side validation and server-side enforcement
// -----------------------------------------------------------------------------

export const LIMITS = {
  displayNameMax: 50,
  conversationTitleMax: 100,
  transcriptMax: 2000,
  /** Max upload size for one utterance. Opus at 32 kbps is roughly 240 KB per minute. */
  audioUploadMaxBytes: 4 * 1024 * 1024,
  /** Max length of an utterance the client will send, in milliseconds. */
  utteranceMaxMs: 60_000,
  /** Recordings shorter than this are treated as accidental taps. */
  utteranceMinMs: 300,
  conversationsPageMax: 100,
  conversationsPageDefault: 50,
  /** Turns one user may take per UTC day; protects the provider bill, not the platform. */
  dailyTurnsDefault: 300,
  inviteNameMax: 80,
  inviteReasonMax: 500,
} as const;

export const ACCEPTED_AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
] as const;

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

export const updateSettingsRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(LIMITS.displayNameMax).optional(),
    voice: voiceIdSchema.optional(),
    persona: personaIdSchema.optional(),
  })
  .refine((v) => v.displayName !== undefined || v.voice !== undefined || v.persona !== undefined, {
    message: 'Provide at least one setting to change.',
  });
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export const settingsResponseSchema = z.object({ user: userSchema });
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

// -----------------------------------------------------------------------------
// Conversations
// -----------------------------------------------------------------------------

export const listConversationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.conversationsPageMax)
    .default(LIMITS.conversationsPageDefault),
  cursor: z.string().min(1).optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export const listConversationsResponseSchema = z.object({
  conversations: z.array(conversationSchema),
  nextCursor: z.string().nullable(),
});
export type ListConversationsResponse = z.infer<typeof listConversationsResponseSchema>;

export const conversationDetailResponseSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema),
});
export type ConversationDetailResponse = z.infer<typeof conversationDetailResponseSchema>;

export const updateConversationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.conversationTitleMax),
});
export type UpdateConversationRequest = z.infer<typeof updateConversationRequestSchema>;

export const updateConversationResponseSchema = z.object({ conversation: conversationSchema });
export type UpdateConversationResponse = z.infer<typeof updateConversationResponseSchema>;

// -----------------------------------------------------------------------------
// Voice turn pipeline. A turn is three requests so each stays well under the
// Workers free-tier CPU budget and the client can show progress between stages.
// -----------------------------------------------------------------------------

/** Stage 1: POST /api/turns/transcribe with a raw audio body. */
export const transcribeResponseSchema = z.object({
  transcript: z.string(),
  language: z.string().nullable(),
});
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;

/** Stage 2: POST /api/turns/respond. */
export const respondRequestSchema = z.object({
  conversationId: z.string().min(1).max(64).optional(),
  transcript: z.string().trim().min(1).max(LIMITS.transcriptMax),
});
export type RespondRequest = z.infer<typeof respondRequestSchema>;

export const respondResponseSchema = z.object({
  conversation: conversationSchema,
  isNewConversation: z.boolean(),
  userMessage: messageSchema,
  assistantMessage: messageSchema,
  /** Turns remaining today, so the client can warn before the cap. */
  turnsRemainingToday: z.number().int().nonnegative(),
});
export type RespondResponse = z.infer<typeof respondResponseSchema>;

/** Stage 3: GET /api/messages/:id/audio streams synthesized speech for an assistant message. */
export const SPEECH_CONTENT_TYPE = 'audio/mpeg';

// -----------------------------------------------------------------------------
// Invite requests (public)
// -----------------------------------------------------------------------------

export const inviteRequestSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.inviteNameMax),
  email: z.string().trim().toLowerCase().email().max(254),
  reason: z.string().trim().max(LIMITS.inviteReasonMax).default(''),
  /** Cloudflare Turnstile response token; required when the site key is configured. */
  turnstileToken: z.string().max(4096).optional(),
  /** Honeypot: real users never fill this. */
  website: z.string().max(200).optional(),
});
export type InviteRequest = z.infer<typeof inviteRequestSchema>;

export const inviteResponseSchema = z.object({
  received: z.literal(true),
});
export type InviteResponse = z.infer<typeof inviteResponseSchema>;

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
