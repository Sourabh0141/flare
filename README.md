# Flare

A voice companion with a face. Hold a button, or just talk, and a 3D character listens,
thinks, and answers out loud with a mood, a gesture, and lip-sync computed in your browser.

Flare runs entirely on free tiers: Cloudflare Pages, Workers, D1, Rate Limiting and
Turnstile; Clerk for sign-in; DeepInfra for speech-to-text, the language model and
text-to-speech.

## What it does

- **Two ways to talk.** Hold the button (or Space) and release to send, or switch on
  hands-free: a voice-activity gate on your device learns the room and sends a turn when you
  pause. Hands-free is half-duplex, so the microphone rests while Flare thinks or speaks.
- **A character that reacts.** Ten moods on the face, procedural nods and shakes, laugh and
  dance clips, gaze that follows you, breathing, blinking, and stage light that follows the
  conversation. Try it on the how-it-works page.
- **Your Flare.** Eight voices with previews, four personalities, your name in the prompt.
- **Your data.** Transcript export and copy, per-conversation delete, and one button that
  erases everything. Audio is never stored.
- **Invite-only.** A public request form stored in D1, protected by a honeypot, IP rate
  limits, and Turnstile when configured.
- **Spend guard.** A daily turn cap per user, with a warning when ten are left.

## How a turn works

```
browser ──audio──▶ Worker ──▶ Whisper          (1) transcribe
browser ──text───▶ Worker ──▶ D1 + Llama       (2) respond: reply, emotion, gesture, title
browser ◀─mp3────  Worker ◀── Kokoro           (3) speak, streamed straight through
```

Each stage is its own request. That keeps every Worker invocation well under the free plan's
10 ms CPU budget, lets the transcript appear while the model is still thinking, and makes
every stage interruptible. The Worker never decodes audio or parses uploads; the browser
records, detects speech and silence, meters input, plays audio and animates the face.

The character is deterministic apart from two enum values (emotion, gesture) chosen by the
model together with its reply. Everything else is a state machine on the client.

## Repository layout

```
apps/
  api/          Cloudflare Worker (Hono): auth, validation, rate limiting, turn pipeline,
                voices, invites
  web/          Next.js static export: landing, how it works, help, invite, privacy, terms,
                changelog, assistant, settings, sign-in
packages/
  contracts/    Zod schemas and types shared by the Worker and the client
  db/           D1 repositories and migrations
terraform/      D1, R2 and Pages, split into modules
.github/        CI (every push and PR) and deploy (main)
```

## Local development

Requirements: Node 22 (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev:api       # Worker on http://127.0.0.1:8787 with a local D1
npm run dev:web       # Next.js on http://localhost:3000
```

The Worker needs `DEEPINFRA_API_KEY` and either `CLERK_JWT_KEY` or `CLERK_SECRET_KEY` to
serve real turns; the web client needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`NEXT_PUBLIC_API_URL`. In this project those values are provided by the deployment pipeline
rather than local files. To run against real services locally, `apps/api/.dev.vars.example`
lists the Worker variables (`wrangler dev` reads `.dev.vars`, which is git-ignored), and the
web client reads `.env.local` (see `apps/web/.env.example`).

Everything that does not need a provider works without any configuration:

```sh
npm run check         # typecheck + lint + format check + tests + build, all workspaces
npm test              # Worker tests run on workerd with a real local D1
npm run db:migrate:local
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: verify, Terraform apply, D1
migrations, Worker secrets and deploy, web build, Pages deploy. Pull requests and other
branches run `.github/workflows/ci.yml`.

### GitHub secrets

| Secret                              | Used for                                               |
| ----------------------------------- | ------------------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`             | Terraform, Wrangler                                    |
| `CLOUDFLARE_API_TOKEN`              | Terraform, Wrangler (D1, R2, Pages, Workers)           |
| `R2_ACCESS_KEY_ID`                  | Terraform state backend                                |
| `R2_SECRET_ACCESS_KEY`              | Terraform state backend                                |
| `DEEPINFRA_API_KEY`                 | Worker secret                                          |
| `CLERK_SECRET_KEY`                  | Worker secret (session verification via JWKS)          |
| `CLERK_JWT_KEY`                     | Worker secret, optional: networkless verification      |
| `TURNSTILE_SECRET_KEY`              | Worker secret, optional: bot check on the invite form  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web build                                              |
| `NEXT_PUBLIC_API_URL`               | Web build, e.g. `https://flare-api.<acct>.workers.dev` |
| `NEXT_PUBLIC_ASSETS_URL`            | Web build, optional: serve models from R2 instead      |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`    | Web build, optional: pairs with `TURNSTILE_SECRET_KEY` |
| `NEXT_PUBLIC_REPO_URL`              | Web build, optional: "Source code" link in the footer  |

`CLERK_JWT_KEY` is the PEM public key from Clerk Dashboard, API keys, "Show JWT public key".
Store it with real newlines or with literal `\n`; the Worker accepts both.

### Non-secret configuration

`apps/api/wrangler.jsonc` holds the model names, the D1 binding, rate limits,
`DAILY_TURN_LIMIT` (turns per user per UTC day, default 300) and `ALLOWED_ORIGINS`
(comma separated, `*` allowed once per host, e.g. `https://*.flare-web.pages.dev`). Origins
listed there are also passed to Clerk as authorized parties, so a session token minted for
another site is rejected.

Voices and personalities are defined in `packages/contracts/src/voices.ts`; add an entry
there and it appears in settings and is accepted by the API.

### Clerk dashboard

- Restrictions: turn on **Restricted** sign-up mode so only invited users can create accounts.
  This is included in the free plan (the allowlist feature is not, and is not needed).
- Invite people from the Users page; the invitation link lands on `/sign-up`. Invite
  requests submitted on the site are in the D1 table `invite_requests`
  (`npx wrangler d1 execute flare-db --remote --command "SELECT name, email, reason, created_at FROM invite_requests ORDER BY created_at DESC"`).
- Allowed origins / redirect URLs: add the Pages hostname and `http://localhost:3000`.

### Cloudflare dashboard

- Nothing beyond the API token and account ID; Terraform creates D1, R2 and Pages, and
  Wrangler creates the Worker, its Rate Limiting bindings and secrets.
- Optional: create a Turnstile widget (free) for the Pages hostname and add its site key and
  secret key as the two Turnstile secrets above.
- Workers Logs are enabled in `wrangler.jsonc` and show up under the Worker's Logs tab.

## Cost and limits

- Workers free: 100k requests/day, 10 ms CPU per request. A turn is three requests, each a
  few milliseconds of CPU; the audio stream passes through without buffering.
- Rate limits: 40 turn-stage calls and 240 API calls per user per minute, 6 invite requests
  per IP per minute (all per Cloudflare location). Daily cap: 300 turns per user.
- LLM tokens: one call per turn with a short system prompt; conversations past 20 messages
  are folded into a rolling summary in the background.
- DeepInfra is pay-as-you-go; Whisper is billed per minute of audio and Kokoro per character.
  Voice previews are cached by the browser for a day.

## Verification

```sh
npm run check
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform init -backend=false && terraform -chdir=terraform validate
```
