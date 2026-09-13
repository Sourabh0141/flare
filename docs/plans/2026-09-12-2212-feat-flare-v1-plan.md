---
title: Flare V1 - Plan
type: feat
date: 2026-09-12
topic: flare-v1
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
origin: docs/requirements/2026-09-12-1911-feat-flare-v1-requirements.md
---

## Goal Capsule

- **Objective:** An invite-only AI voice assistant web app where authenticated users hold push-to-talk conversations with a 3D animated AI character — deployed on Cloudflare infrastructure and serving as a technical showcase portfolio piece.
- **Authority:** This plan owns implementation of V1 of the Flare product.
- **Execution:** code
- **Execution profile:** Full-stack web application — Next.js frontend, Cloudflare Workers backend, D1 (SQLite), R2 (object storage), Clerk authentication, DeepInfra AI APIs, Terraform infrastructure-as-code, GitHub Actions CI/CD.
- **Stop conditions:** These requirements are satisfied when a deployed, auth-gated Flare application on `*.workers.dev` / `*.pages.dev` supports authenticated push-to-talk conversations with the 3D AI character, history in the sidebar, and infrastructure fully managed through CI/CD.

## Product Contract

### Summary
Flare V1 is a voice-first AI conversation web app centered on a 3D animated character. Invite-only users authenticate with Clerk, then hold push-to-talk conversations with a general-purpose AI assistant whose responses are spoken aloud with browser-driven lip-sync. Conversation history is preserved in the sidebar. The full infrastructure — Cloudflare Workers, D1, R2, GitHub Actions, Terraform — ships as part of V1.

### Problem Frame
The primary motivation is demonstrating technical capability to a curated audience. The app functions as a portfolio showcase rather than a general-purpose consumer product, which explains several design choices: invite-only access (credentials distributed manually), no self-serve sign-up, and a deployment that trades latency optimization for simplicity. The "wow factor" comes from the combination of a distinctive 3D AI character, convincing lip-sync, and natural push-to-talk conversation — not from the breadth of features.

### Requirements

#### Authentication and Access
- **R1.** The landing page is accessible without authentication. It contains a hero section with an animated visual (a preview or still of the 3D AI character) and a sign-in call-to-action.
- **R2.** All routes other than the landing page redirect unauthenticated users to the Clerk sign-in flow.
- **R3.** New accounts cannot self-register. The operator creates accounts manually via the Clerk dashboard. Sign-up UI may be present (Clerk default) but is not a supported user path.
- **R4.** After successful sign-in, the user is redirected to the main application view.
- **R5.** The API Worker validates the Clerk JWT on every request. Requests without a valid JWT receive a 401 response.

#### Landing Page
- **R6.** The landing page hero contains an animated visual involving the 3D AI character and a sign-in button that launches the Clerk sign-in modal or page.
- **R7.** The landing page is a static page served from Cloudflare Pages (no server-side rendering required for the landing page itself).

#### Main Application Layout
- **R8.** The main application has a collapsible sidebar on the left and a primary canvas area on the right. The sidebar is open by default on desktop and closed by default on mobile.
- **R9.** The primary canvas area displays the 3D AI character at full height as the centerpiece.
- **R10.** A push-to-talk button is persistently visible in the canvas area. Its visual state reflects the current interaction state: idle, listening, speaking, processing, error.

#### Sidebar — Conversation History
- **R11.** The sidebar lists all of the authenticated user's conversations, ordered by most recent activity, showing conversation title and relative timestamp (e.g., "Today", "Yesterday", "Sep 10").
- **R12.** Tapping a conversation in the sidebar loads that conversation's state and makes it the active conversation. The character animates into idle state.
- **R13.** Each conversation entry in the sidebar has a context menu (or inline actions) with two options: Rename and Delete.
- **R14.** Rename opens an inline text field pre-filled with the current title. Saving commits the new title to D1.
- **R15.** Delete removes the conversation and all its messages from D1. The action requires a confirmation prompt before execution.
- **R16.** A "New Conversation" button is present at the top of the sidebar. Tapping it creates a new conversation and makes it active.
- **R17.** If no conversations exist, the sidebar shows an empty state with a prompt to start speaking.

#### Conversation Behavior
- **R18.** A new conversation is created automatically when: (a) the user taps "New Conversation", or (b) the first voice message arrives after 30 minutes of inactivity in the prior conversation.
- **R19.** The conversation title is generated automatically by the LLM after the first exchange. The generated title is stored in D1 and displayed in the sidebar. If title generation fails, a default title ("New conversation") is used.
- **R20.** No text transcript is shown in the main view during or after a conversation. The conversation is a pure voice experience. The sidebar is the only place conversation history is visible (as title + timestamp, not as readable message text).

#### Push-to-Talk Interaction
- **R21.** Hold the push-to-talk button to record; release to send. Releasing always triggers submission.
- **R22.** While recording, the browser captures audio as a Blob (WAV or MP3). A visual indicator confirms that recording is active.
- **R23.** On release, the recorded audio Blob is POSTed to the API Worker's `/api/chat` endpoint along with the current conversation ID and the user's Clerk JWT.
- **R24.** While the API Worker is processing (ASR + LLM + TTS in sequence), the push-to-talk button displays a disabled state and the character displays the processing animation. The user cannot send another message during processing.
- **R25.** If the user presses a stop/interrupt button while the character is speaking, audio playback stops immediately and the interaction returns to idle state. The interrupted exchange is stored in D1 as-is.
- **R26.** After the audio response finishes playing, the interaction returns to idle state.

#### AI Response Pipeline (API Worker)
- **R27.** The API Worker receives the audio Blob and conversation ID. It fetches the conversation's message history from D1 (recent messages, preceded by summary if one exists).
- **R28.** The API Worker sends the audio Blob to DeepInfra ASR (Whisper). The transcript is stored as a user message row in D1.
- **R29.** The API Worker sends the conversation context (system prompt + optional summary + recent messages) plus the new user transcript to the DeepInfra chat completions API. The full LLM response is collected before proceeding.
- **R30.** The LLM response text is stored as an assistant message row in D1.
- **R31.** The API Worker sends the LLM response text to the DeepInfra TTS API. The returned audio is streamed back to the browser as the HTTP response body.
- **R32.** If any DeepInfra call fails (network error, non-2xx response, timeout), the API Worker returns a designated error response. The browser detects this and plays the fallback audio clip. The failed exchange is stored in D1 with an error annotation.

#### Summarization
- **R33.** After storing a new assistant message in D1, the API Worker checks whether the conversation has crossed 20 non-summary messages. When the threshold is first crossed, summarization is triggered via `ctx.waitUntil()` (does not delay the HTTP response).
- **R34.** Summarization sends the oldest 10 messages to the LLM with a summarization prompt. The result is stored as a synthetic `summary` role message. The 10 summarized messages are deleted from D1.
- **R35.** When building the LLM context window, the API Worker includes: any existing summary message first, then remaining non-summary messages, capped at the model's safe context limit.

#### 3D Character
- **R36.** The 3D character is a stylized full-body GLB avatar (futuristic outfit, 67-joint humanoid rig, 67 morph targets including all 15 ARKit `viseme_` targets) rendered using `avatoon` (React Three Fiber + Three.js + Drei) in the browser. Sourced from Wawa Sensei's open-source R3F avatar repository, the asset is pre-baked with all ARKit visemes and animations, requiring no Blender processing, and is served via Cloudflare R2 / CDN.
- **R37.** The character transitions between four states: **idle** (breathing/floating idle loop), **listening** (subtle reaction while PTT is held), **processing** (thinking animation), **speaking** (lip-sync animation active).
- **R38.** During speaking state, the browser plays the audio through the Web Audio API. An `AnalyserNode` reads FFT frequency data in real time, maps it to ARKit viseme weights, and updates the avatar's blend shape morph targets each animation frame.
- **R39.** The idle animation includes continuous subtle motion (e.g., gentle floating, eye blinks, head micro-movements). Random idle behaviors (e.g., head tilt, glance, posture shift) trigger at unpredictable intervals.

#### Settings
- **R40.** A settings panel is accessible from a persistent icon in the UI.
- **R41.** The settings panel contains one editable field: Display Name. Saving updates the value in D1 for the authenticated user.

#### Infrastructure and Operations
- **R42.** All infrastructure is declared in Terraform. Provisioned resources include: R2 bucket (Terraform state + static assets), D1 database, Cloudflare Worker (API Worker), Cloudflare Pages project (frontend).
- **R43.** No credentials are hardcoded in the repository. All secrets (Cloudflare API token, DeepInfra API key, Clerk keys, R2 backend credentials) are stored as GitHub Actions secrets and injected at deploy time.
- **R44.** A push to `main` triggers: (1) `terraform apply`, (2) `wrangler deploy` for the API Worker, (3) Cloudflare Pages build and deploy for the Next.js frontend.
- **R45.** D1 schema is managed via migration files in the repository. Migrations run automatically in CI/CD before Worker deploy.

### Key Decisions
- **Voice-only input in V1 (no text).** Text input is explicitly deferred to preserve the character-first impression. (session-settled: user-directed — chosen over voice+text).
- **Sequential conversation pipeline: LLM completes → TTS → audio plays.** Streaming-per-sentence TTS is deferred for simplicity. (session-settled: user-approved — chosen over streaming-per-sentence).
- **HTTP per conversation turn (no WebSocket in V1).** One HTTP request per turn: browser POSTs audio, backend returns audio response. (session-settled: user-approved).
- **Stylized full-body GLB avatar with ARKit viseme morph targets, rendered using `avatoon`.** Ready Player Me was shut down on January 31, 2026 (acquired by Netflix). `avatoon` is an MIT-licensed, actively maintained React Three Fiber component that renders any GLB asset with ARKit `viseme_` morph targets — the same naming convention the plan's lip-sync approach requires. Sourced from Wawa Sensei's open-source R3F avatar repository ([github.com/wass08/r3f-virtual-girlfriend-frontend](https://github.com/wass08/r3f-virtual-girlfriend-frontend), `64f1a714fe61576b46f27ca2.glb`, saved in repo as `models/avatar.glb`), this verified full-body avatar includes 67 skeletal joints and 67 morph targets (all 15 ARKit visemes) plus a companion animation set (`animations.glb`). Additional compatible animations can be sourced directly from the official Ready Player Me Animation Library ([github.com/readyplayerme/animation-library](https://github.com/readyplayerme/animation-library) / [GLB collection](https://github.com/crazyramirez/babylonjs-ReadyPlayerMe-Animation-Combiner)) or Adobe Mixamo ([mixamo.com](https://www.mixamo.com)). Because all shape keys and rigs are pre-baked, no Blender processing or 3D modeling is required. The avatar GLB is hosted on R2 and served via CDN. (session-settled: updated from RPM — verified plug-and-play asset with pre-baked ARKit visemes). (Governs R36)
- **Lip-sync driven by browser-side Web Audio API viseme analysis.** Browser analyzes the audio stream via `AnalyserNode` FFT to infer viseme weights, driving the avatar's ARKit `viseme_` blend shapes via `avatoon`'s morph target controls. (session-settled: user-directed). (Governs R38)
- **All conversation messages stored in D1; audio is ephemeral.** (Governs R27)
- **Summarization triggers at 20 messages: oldest half summarized.** (Governs R33, R34)
- **Terraform state in R2 using S3-compatible backend.** (session-settled: user-directed). (Governs R42)
- **GitHub Actions CI/CD: push to `main` triggers Wrangler deploy.** (session-settled: user-directed). (Governs R43, R44)
- **Inactivity auto-expiry: 30 minutes.** (Governs R18)
- **Display name is the only V1 user setting.** (Governs R41)
- **Error fallback: pre-recorded audio clip.** (Governs R32)

### Actors
- **A1. Authenticated user** — a person given credentials by the operator; can access all post-login features.
- **A2. Operator** — the app owner; provisions user credentials through Clerk, manages secrets, deploys via CI/CD.
- **A3. API Worker** — the Cloudflare Worker that proxies requests to DeepInfra and reads/writes D1.
- **A4. DeepInfra** — the external AI service providing ASR, LLM, and TTS.
- **A5. Clerk** — the external identity service managing sign-in/sign-up and issuing JWTs.

### Key Flows
- **F1. First-time sign-in**: A1 -> A5 -> main app.
- **F2. Push-to-talk conversation turn**: A1 -> A3 -> A4 -> A1.
- **F3. Interruption during AI response**: A1 stops audio playback.
- **F4. Auto-create new conversation after inactivity**: A3 creates new conversation if last message >30 min old.
- **F5. Rename conversation**: A1 -> A3.
- **F6. Summarization (background)**: A3 -> A4.

### Acceptance Examples
- **AE1. PTT blocked during processing.** (Covers R24)
- **AE2. Interruption returns to idle.** (Covers R25)
- **AE3. Fallback audio on API error.** (Covers R32)
- **AE4. Inactivity creates new conversation.** (Covers R18)
- **AE5. Summarization does not delay response.** (Covers R33)
- **AE6. History persists across sessions.** (Covers R11, R12)
- **AE7. Delete requires confirmation.** (Covers R15)

### Success Criteria
- **SC1.** A visitor watching someone use Flare for 30 seconds identifies it as technically impressive.
- **SC2.** The full infrastructure can be reproduced from a clean Cloudflare account using CI/CD.
- **SC3.** The API Worker stays within Cloudflare Free tier CPU limits (10ms CPU per request).
- **SC4.** A conversation turn completes in under 8 seconds on a typical broadband connection.
- **SC5.** Conversation history is durable across browser sessions and devices.

### Scope Boundaries
**Deferred for later (V2+):** Text input, VAD (auto-send on silence), WebSockets, LLM-controlled animations, custom voices/personas, streaming-per-sentence, audio replay, custom domain, staging environment, per-user rate limiting, full-text search.
**Outside this product's identity:** Self-serve sign-up, text-only chat mode, mobile-native app, multi-user sessions.

### Sources and Research
- Cloudflare Workers Free tier limits (10ms CPU limit excludes fetch wait time).
- DeepInfra TTS (`/v1/text-to-speech/{voice_id}/stream`), Whisper ASR multipart upload, LLM completions.
- `avatoon` for React Three Fiber ARKit viseme morph-target rendering (replaces `@readyplayerme/visage`, which is abandoned following RPM's shutdown on January 31, 2026).
- 3D Avatar Asset & Animations — Pre-rigged full-body GLB avatar with 67 ARKit blendshapes and companion animation suite. Sourced from Wawa Sensei's open-source React Three Fiber companion project: [github.com/wass08/r3f-virtual-girlfriend-frontend](https://github.com/wass08/r3f-virtual-girlfriend-frontend) (`public/models/64f1a714fe61576b46f27ca2.glb` and `public/models/animations.glb`).
- Web Audio API `AnalyserNode` for FFT analysis.
- Cloudflare R2 S3-compatible Terraform backend.

---

## Planning Contract

### Key Technical Decisions
- **KTD1.** **Monorepo Structure (npm workspaces).** The repository will use a standard npm/pnpm workspace with `apps/web` (Next.js), `apps/api` (Cloudflare Worker), and `packages/db` (D1 migrations/schema) to separate concerns while sharing types. (Governs R42)
- **KTD2.** **Audio Format.** The browser will record audio using the native `MediaRecorder` API, generating `audio/webm` (or `audio/mp4` on Safari). DeepInfra Whisper API supports these formats natively, avoiding the need for heavy client-side WAV transcoding. (Governs R22, R28)
- **KTD3.** **Two Separate R2 Buckets.** Terraform state (which contains sensitive infrastructure secrets) will be stored in a private R2 bucket. Public application assets (the avatar glTF and fallback audio) will be stored in a separate public R2 bucket. (session-settled: user-directed — chosen over single bucket: mixing state and assets violates security best practices). (Governs R8, R42)
- **KTD4.** **Clerk Worker Authentication.** The API Worker will use `@clerk/backend` to verify JWTs, validating the token directly without needing to contact Clerk's API on every request. (Governs R5, R23)
- **KTD5.** **DeepInfra API Fetch calls.** The API Worker will use native `fetch` to communicate with DeepInfra APIs. For ASR, it will construct a `FormData` payload containing the Blob. For TTS, the response body will be streamed directly back to the client. (Governs R28, R29, R31)

### Assumptions
- DeepInfra APIs (`/v1/inference/openai/whisper-large-v3`, `/v1/chat/completions`, `/v1/text-to-speech`) are available and accessible from Cloudflare Workers without IP restrictions.
- The user has obtained the necessary Clerk, Cloudflare, and DeepInfra credentials for CI/CD injection.

### System-Wide Impact
- **Security:** Infrastructure secrets will be managed by GitHub Actions. Terraform state must remain strictly private. The frontend and API worker must securely validate JWTs.

---

## Implementation Units

### U1. Initialize Monorepo and Terraform Infrastructure
**Goal:** Establish the workspace structure and provision Cloudflare resources.
**Requirements:** R42
**Files:**
- `package.json`
- `terraform/main.tf`
- `terraform/variables.tf`
- `terraform/providers.tf`
**Approach:**
- Set up root `package.json` with workspaces for `apps/*` and `packages/*`.
- Configure `terraform/main.tf` with the Cloudflare provider.
- Provision two R2 buckets (one private for Terraform backend, one for app assets) per KTD3. Configure a CORS policy on the app assets bucket allowing GET requests from the frontend origin.
- Provision a D1 database.
- Provision a Cloudflare Pages project for the frontend.
**Execution note:** Run `terraform apply` locally first (or via manual CI trigger) to bootstrap the state bucket.
**Patterns to follow:** Standard Cloudflare Terraform provider documentation.
**Test scenarios:**
- Test expectation: none -- infrastructure-as-code scaffolding.
**Verification:** Terraform initializes and plans successfully; resources appear in the Cloudflare dashboard.

### U2. Setup GitHub Actions CI/CD
**Goal:** Automate deployment of infrastructure, database migrations, worker, and frontend.
**Requirements:** R43, R44, R45
**Dependencies:** U1
**Files:**
- `.github/workflows/deploy.yml`
**Approach:**
- Create a workflow triggered on push to `main`.
- Inject secrets from GitHub Actions environment.
- Step 1: `terraform apply -auto-approve`.
- Step 2: Apply D1 migrations.
- Step 3: Build and deploy API Worker (`wrangler deploy`).
- Step 4: Build and deploy Next.js frontend (`npm run build` then deploy to Pages).
**Test scenarios:**
- Test expectation: none -- CI/CD pipeline definition.
**Verification:** Committing to `main` successfully deploys all components without manual intervention.

### U3. Database Schema and Queries
**Goal:** Define the D1 schema and provide typed access to it.
**Requirements:** R6, R10, R11, R13, R19, R27, R30, R34, R41
**Dependencies:** U1
**Files:**
- `packages/db/schema.sql`
- `packages/db/src/index.ts`
- `packages/db/package.json`
**Approach:**
- `schema.sql`: Create tables `users` (id, display_name), `conversations` (id, user_id, title, updated_at), and `messages` (id, conversation_id, role, content, created_at, type).
- `index.ts`: Export type definitions and helper functions for standard queries (create conversation, insert message, get recent messages, delete conversation, update title).
**Test scenarios:**
- Covers happy path behaviors: Inserting a message returns the correct ID; fetching recent messages respects ordering and limits.
- Covers edge cases: Fetching messages for an empty conversation returns an empty array.
**Verification:** Migrations run successfully against a local D1 instance (`wrangler d1 execute`).

### U4. API Worker - Authentication and Routing
**Goal:** Set up the Cloudflare Worker with Clerk JWT validation and basic routing.
**Requirements:** R5, R23
**Dependencies:** U3
**Files:**
- `apps/api/src/index.ts`
- `apps/api/src/auth.ts`
- `apps/api/wrangler.toml`
- `apps/api/package.json`
**Approach:**
- Use Hono or a lightweight router for the Worker.
- Configure global CORS middleware to allow cross-origin requests from the Next.js frontend.
- Implement middleware in `auth.ts` using `@clerk/backend` `verifyToken` to validate the incoming JWT from the `Authorization` header.
- Return 401 Unauthorized if the token is missing or invalid.
**Test scenarios:**
- Covers happy path behaviors: Valid JWT allows request to proceed to route handler.
- Covers error paths: Missing JWT returns 401; expired/invalid JWT returns 401.
**Verification:** Requests to the worker with a valid Clerk JWT succeed, while invalid requests are blocked.

### U5. API Worker - Conversation Turn Pipeline (ASR + LLM + TTS)
**Goal:** Implement the core AI processing pipeline.
**Requirements:** R18, R19, R27, R28, R29, R30, R31, R32
**Dependencies:** U4
**Files:**
- `apps/api/src/routes/chat.ts`
- `apps/api/src/deepinfra.ts`
**Approach:**
- `POST /api/chat`: Accept `multipart/form-data` with the audio Blob and `conversationId`.
- Fetch conversation history from D1. If `conversationId` is missing or invalid (or >30 min old), create a new conversation.
- Send audio Blob to DeepInfra Whisper (ASR). Save user transcript to D1.
- Send context + new transcript to DeepInfra LLM (Chat). Save assistant response to D1.
- Send assistant response to DeepInfra TTS. Return the resulting audio payload back to the client.
- Error handling: Use an `AbortController` to enforce a timeout on DeepInfra API calls. Catch `fetch` errors or timeouts, log them, and return a 503 error response.
**Test scenarios:**
- Covers happy path behaviors: A valid audio file results in a streaming audio response and two new D1 message rows.
- Covers edge cases: Missing conversation ID creates a new conversation; >30 mins since last message creates a new conversation.
- Covers AE3: Simulating a DeepInfra 503 returns a 503 from the Worker.
**Verification:** The endpoint processes audio, interacts with DeepInfra, updates D1, and streams back the audio response.

### U6. API Worker - Background Summarization
**Goal:** Summarize old messages to preserve context window limits.
**Requirements:** R33, R34, R35
**Dependencies:** U5
**Files:**
- `apps/api/src/summarize.ts`
- `apps/api/src/routes/chat.ts`
**Approach:**
- In the `POST /api/chat` handler, after returning the response, use `ctx.waitUntil()` to check message count.
- If > 20 non-summary messages, fetch the oldest 10, send to DeepInfra LLM for summarization, insert summary row, and delete the 10 messages.
**Test scenarios:**
- Covers happy path behaviors: Reaching 21 messages triggers a summary creation and deletes the oldest 10 messages.
- Covers AE5: The HTTP response completes before summarization finishes.
**Verification:** The summarization runs asynchronously and successfully reduces the message count in D1.

### U7. Frontend - Layout, Auth, and Sidebar
**Goal:** Build the Next.js shell with Clerk integration and conversation history.
**Requirements:** R1, R2, R4, R8, R11, R12, R13, R14, R15, R16, R17
**Dependencies:** U4
**Files:**
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/package.json`
**Approach:**
- Configure Next.js for static export (`output: 'export'` in `next.config.js`) to deploy as a purely static site on Cloudflare Pages.
- Integrate `<ClerkProvider>`. Protect routes using middleware.
- Landing page (`page.tsx`) with hero and sign-in button.
- Main layout with a collapsible `Sidebar` component.
- Sidebar fetches conversations from the API Worker (`GET /api/conversations`).
- Implement rename/delete context menus calling Worker endpoints (`PATCH` / `DELETE`).
**Test scenarios:**
- Covers AE6: Sidebar loads existing conversations correctly.
- Covers AE7: Deleting a conversation shows a prompt and updates the list upon confirmation.
**Verification:** Unauthenticated users are forced to sign in. The sidebar correctly displays, updates, and deletes conversations.

### U8. Frontend - 3D Character and Lip-Sync
**Goal:** Render the stylized full-body GLB avatar with idle and speaking animations driven by audio.
**Requirements:** R9, R36, R37, R38, R39
**Dependencies:** U7
**Files:**
- `apps/web/src/components/AvatarCanvas.tsx`
- `apps/web/src/hooks/useVisage.ts`
**Approach:**
- Use `avatoon` in a React Three Fiber `<Canvas>` to render the verified full-body GLB asset (`avatar.glb` with companion `animations.glb`) loaded from the public R2 bucket.
- Implement state machine: `idle`, `listening`, `processing`, `speaking`.
- Use Web Audio API `AnalyserNode` to map FFT data to ARKit `viseme_` morph target weights when in the `speaking` state, driving `avatoon`'s morph target controls each animation frame.
**Execution note:** Ensure the canvas resizes correctly and the glTF loads asynchronously without blocking the UI.
**Test scenarios:**
- Covers happy path behaviors: Character renders in idle state; transitions to speaking state when audio plays.
**Verification:** The 3D character renders smoothly at 60fps and lip-syncs reasonably well to arbitrary audio.

### U9. Frontend - Push-to-Talk Interaction
**Goal:** Record audio, manage interaction state, and play back responses.
**Requirements:** R10, R21, R22, R24, R25, R26
**Dependencies:** U5, U8
**Files:**
- `apps/web/src/components/PushToTalkButton.tsx`
- `apps/web/src/hooks/useConversation.ts`
**Approach:**
- Use `MediaRecorder` API to capture audio while the PTT button is held.
- On release, POST the Blob to `/api/chat` with the JWT.
- Manage UI state (`idle`, `recording`, `processing`, `playing`).
- Await the full audio response from the POST request, convert it to a Blob, and play it seamlessly via `URL.createObjectURL(blob)`.
- If an error occurs, play the fallback audio clip from R2 (ensuring `crossOrigin="anonymous"` is set on the audio element to allow Web Audio API analysis).
- Implement an interrupt button that stops playback and cancels pending fetch.
**Test scenarios:**
- Covers AE1: Button is disabled when state is `processing`.
- Covers AE2: Interrupting stops audio and sets state to `idle`.
**Verification:** The user can record a message, wait for processing, see the avatar speak, and interrupt the response if desired.

---

## Verification Contract
- **Commands:**
  - `npm run dev` to start frontend and worker locally.
  - `npm run test` (if unit tests are added).
  - `wrangler d1 execute` for local database queries.
- **Quality Gates:**
  - The API Worker must complete its processing within the Free tier CPU limits (excluding `fetch` wait times).
  - The 3D avatar must load without significant blocking (use Suspense/loading placeholders).
  - PTT interaction must feel responsive, with correct visual state feedback.

## Definition of Done
- **Global:**
  - The app is deployed to Cloudflare Pages and Workers.
  - CI/CD successfully deploys on `main` branch pushes.
  - The end-to-end flow (record -> AI processes -> 3D avatar speaks) works securely behind Clerk auth.
  - Dead-end or experimental code from implementation attempts is removed.
- **Per-unit:**
  - Unit tests (where applicable) pass.
  - Local verification steps succeed.
