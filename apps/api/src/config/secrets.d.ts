/**
 * Secrets are set with `wrangler secret put` and therefore absent from wrangler.jsonc, so
 * `wrangler types` cannot see them. These declarations merge into the generated `Env`
 * (both the global interface and the `Cloudflare.Env` namespace member).
 */
interface __FlareSecrets {
  CLERK_JWT_KEY?: string;
  CLERK_SECRET_KEY?: string;
  DEEPINFRA_API_KEY?: string;
  /** Optional: enables Cloudflare Turnstile verification on public forms. */
  TURNSTILE_SECRET_KEY?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env extends __FlareSecrets {}

declare namespace Cloudflare {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env extends __FlareSecrets {}
}
