/**
 * Public runtime configuration. Values are inlined at build time by Next.js from
 * NEXT_PUBLIC_* variables, which the deployment pipeline provides. Nothing here is secret.
 */

export interface PublicConfig {
  clerkPublishableKey: string | null;
  apiBaseUrl: string;
  /** Where the 3D models are served from; defaults to the site's own /models folder. */
  assetsBaseUrl: string;
  /** Cloudflare Turnstile site key for public forms; forms work without it. */
  turnstileSiteKey: string | null;
  /** Public repository, linked from the footer when set. */
  repoUrl: string | null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export const config: PublicConfig = {
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || null,
  apiBaseUrl: stripTrailingSlash(
    process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:8787'
  ),
  assetsBaseUrl: stripTrailingSlash(process.env.NEXT_PUBLIC_ASSETS_URL?.trim() || ''),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL?.trim() || null,
};

export const MODEL_URLS = {
  avatar: `${config.assetsBaseUrl}/models/avatar.glb`,
  idle: `${config.assetsBaseUrl}/models/idle.glb`,
  animations: `${config.assetsBaseUrl}/models/animations.glb`,
} as const;

export const FALLBACK_AUDIO_URL = '/audio/fallback-error.wav';

export const SITE = {
  name: 'Flare',
  tagline: 'A voice companion with a face.',
  description:
    'Flare is a voice-first AI companion: hold a button or just talk, and a 3D character listens, thinks, and answers out loud with real-time lip-sync and expressions.',
} as const;
