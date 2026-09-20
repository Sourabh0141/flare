import type { D1Database } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker Environment Bindings
 */
export interface AppBindings {
  DB: D1Database;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string;
  DEEPINFRA_API_KEY?: string;
  DEEPINFRA_STT_MODEL?: string;
  DEEPINFRA_LLM_MODEL?: string;
  DEEPINFRA_TTS_MODEL?: string;
  DEEPINFRA_TTS_VOICE?: string;
  ALLOWED_ORIGINS?: string;
}

/**
 * Hono Context Variables populated by middleware
 */
export interface AppVariables {
  userId: string;
  claims?: Record<string, unknown>;
}

/**
 * Combined Hono Environment Type
 */
export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

/**
 * Request payload for updating user display name
 */
export interface UpdateSettingsRequest {
  displayName: string;
}

/**
 * Request payload for updating conversation title
 */
export interface UpdateConversationRequest {
  title: string;
}
