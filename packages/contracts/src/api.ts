import { z } from 'zod';
import { emotionSchema, gestureSchema } from './character';
import {
  conversationSchema,
  intensitySchema,
  inviteRequestRecordSchema,
  inviteStatusSchema,
  messageSchema,
  userSchema,
} from './models';
import { languageCodeSchema, personaIdSchema, voiceIdSchema } from './voices';

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
  adminPageMax: 200,
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

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const listConversationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.conversationsPageMax)
    .default(LIMITS.conversationsPageDefault),
  cursor: z.string().min(1).optional(),
  /** `true` lists archived conversations; default lists active ones. */
  archived: booleanQuery,
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

export const updateConversationRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(LIMITS.conversationTitleMax).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.pinned !== undefined || v.archived !== undefined, {
    message: 'Provide at least one field to change.',
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

/** Stage 2: POST /api/turns/respond. The response is a server-sent event stream. */
export const respondRequestSchema = z.object({
  conversationId: z.string().min(1).max(64).optional(),
  transcript: z.string().trim().min(1).max(LIMITS.transcriptMax),
  /** Language the user spoke, from stage 1; Flare answers in it when it can. */
  language: languageCodeSchema.optional(),
});
export type RespondRequest = z.infer<typeof respondRequestSchema>;

export const expressionSchema = z.object({
  emotion: emotionSchema,
  gesture: gestureSchema,
  intensity: intensitySchema,
});
export type Expression = z.infer<typeof expressionSchema>;

/**
 * Events on the respond stream, in the order they can appear:
 *   meta -> expression -> (delta | sentence | audio)* -> done, or error at any point.
 * Audio arrives per sentence, base64-encoded, so the first sentence can play while the
 * model is still writing the rest.
 */
export const turnEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('meta'),
    conversation: conversationSchema,
    isNewConversation: z.boolean(),
    userMessage: messageSchema,
    turnsRemainingToday: z.number().int().nonnegative(),
    language: z.string(),
  }),
  z.object({ type: z.literal('expression'), expression: expressionSchema }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('sentence'),
    index: z.number().int().nonnegative(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('audio'),
    index: z.number().int().nonnegative(),
    mimeType: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    assistantMessage: messageSchema,
    conversation: conversationSchema,
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type TurnEvent = z.infer<typeof turnEventSchema>;

/** Stage 3 (replays): GET /api/messages/:id/audio streams synthesized speech for a message. */
export const SPEECH_CONTENT_TYPE = 'audio/mpeg';

// -----------------------------------------------------------------------------
// Invite requests (public) and their review (admin)
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

export const listInvitesQuerySchema = z.object({
  status: inviteStatusSchema.default('pending'),
  limit: z.coerce.number().int().min(1).max(LIMITS.adminPageMax).default(100),
});
export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;

export const listInvitesResponseSchema = z.object({
  invites: z.array(inviteRequestRecordSchema),
  counts: z.object({ pending: z.number(), approved: z.number(), dismissed: z.number() }),
});
export type ListInvitesResponse = z.infer<typeof listInvitesResponseSchema>;

export const reviewInviteRequestSchema = z.object({
  status: z.enum(['approved', 'dismissed']),
});
export type ReviewInviteRequest = z.infer<typeof reviewInviteRequestSchema>;

export const reviewInviteResponseSchema = z.object({
  invite: inviteRequestRecordSchema,
  /** True when a Clerk invitation email was sent as part of approval. */
  invitationSent: z.boolean(),
});
export type ReviewInviteResponse = z.infer<typeof reviewInviteResponseSchema>;

export const adminStatusResponseSchema = z.object({ isAdmin: z.boolean() });
export type AdminStatusResponse = z.infer<typeof adminStatusResponseSchema>;

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
