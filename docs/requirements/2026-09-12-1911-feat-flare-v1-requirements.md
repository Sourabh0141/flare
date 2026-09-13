---
title: Flare V1 - Requirements
type: feat
date: 2026-09-12
topic: flare-v1
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Flare V1 - Requirements

## Goal Capsule

- **Objective:** An invite-only AI voice assistant web app where authenticated users hold push-to-talk conversations with a 3D animated AI character — deployed on Cloudflare infrastructure and serving as a technical showcase portfolio piece.
- **Authority:** This requirements document owns V1 of the Flare product in its entirety. Future versions (V2+) are contextual candidates only; they do not constrain this document.
- **Execution:** code
- **Execution profile:** Full-stack web application — Next.js frontend, Cloudflare Workers backend, D1 (SQLite), R2 (object storage), Clerk authentication, DeepInfra AI APIs, Terraform infrastructure-as-code, GitHub Actions CI/CD.
- **Stop conditions:** These requirements are satisfied when a deployed, auth-gated Flare application on `*.workers.dev` / `*.pages.dev` supports authenticated push-to-talk conversations with the 3D AI character, history in the sidebar, and infrastructure fully managed through CI/CD.

---

## Product Contract

### Summary

Flare V1 is a voice-first AI conversation web app centered on a 3D animated character. Invite-only users authenticate with Clerk, then hold push-to-talk conversations with a general-purpose AI assistant whose responses are spoken aloud with browser-driven lip-sync. Conversation history is preserved in the sidebar. The full infrastructure — Cloudflare Workers, D1, R2, GitHub Actions, Terraform — ships as part of V1.

---

### Problem Frame

The primary motivation is demonstrating technical capability to a curated audience. The app functions as a portfolio showcase rather than a general-purpose consumer product, which explains several design choices: invite-only access (credentials distributed manually), no self-serve sign-up, and a deployment that trades latency optimization for simplicity. The "wow factor" comes from the combination of a distinctive 3D AI character, convincing lip-sync, and natural push-to-talk conversation — not from the breadth of features.

---

### Key Decisions

KTD1. **Voice-only input in V1 (no text).** The showcase value is the voice + 3D character experience. Text input dilutes the interaction model and adds UI surface area. Text input is explicitly deferred. (session-settled: user-directed — chosen over voice+text; text input weakens the character-first impression)

KTD2. **Sequential conversation pipeline: LLM completes → TTS → audio plays.** Sentence-by-sentence streaming to TTS (which would lower perceived latency) is deferred. For a showcase that's not used for daily utility, conversation feel is acceptable at simple sequential flow. (session-settled: user-approved — chosen over streaming-per-sentence; simplicity over latency)

KTD3. **HTTP per conversation turn (no WebSocket in V1).** One HTTP request per turn: browser POSTs audio, backend returns audio response. WebSockets are reserved for V2 real-time features. Interruption handling is client-side (cancel in-flight HTTP request + stop audio playback). (session-settled: user-approved — chosen over WebSockets; WebSockets add complexity the sequential pipeline doesn't need)

KTD4. **Stylized full-body GLB avatar with ARKit viseme morph targets, rendered using `avatoon`.** Ready Player Me was shut down on January 31, 2026 (acquired by Netflix). The replacement stack uses `avatoon` — an MIT-licensed, actively maintained React Three Fiber component — to render a stylized full-body GLB asset. The selected avatar is an open-source, production-ready full-body humanoid character (stylized futuristic outfit, purple hair, 67 skeletal joints, and 67 morph targets including all 15 ARKit `viseme_` targets) sourced from Wawa Sensei's open-source R3F avatar project ([github.com/wass08/r3f-virtual-girlfriend-frontend](https://github.com/wass08/r3f-virtual-girlfriend-frontend), specifically `public/models/64f1a714fe61576b46f27ca2.glb`, saved in repo as `models/avatar.glb`), paired with companion skeletal animations (`animations.glb`). Because all ARKit shape keys and rig bones are pre-baked, no 3D modeling or Blender processing is required. `avatoon` drives these morph targets from the browser using the same R3F + Three.js + Drei primitives. The avatar GLB is a one-time operator asset hosted on R2 and served via CDN. (session-settled: updated from RPM — identical rendering architecture; verified plug-and-play asset with pre-baked ARKit visemes)

KTD5. **Lip-sync driven by browser-side Web Audio API viseme analysis.** DeepInfra's TTS API returns audio only — no phoneme or timing data. The browser analyzes the audio stream in real time using `AnalyserNode` FFT frequency data to infer phoneme-approximate viseme weights, which drive the avatar's ARKit `viseme_` blend shapes via `avatoon`'s morph target controls during playback. This produces convincing-approximation sync without external phoneme analysis services. (session-settled: user-directed — chosen over amplitude-only jaw-open; viseme approximation is more convincing for a showcase)

KTD6. **All conversation messages stored in D1; audio is ephemeral.** D1 holds all message rows with role, content, timestamp, and conversation foreign key. TTS-generated audio plays once in the browser and is not persisted. Replay requires re-generation — a V2 feature.

KTD7. **Summarization triggers at 20 messages: oldest half summarized.** When a conversation reaches 20 stored messages, the backend summarizes the oldest 10 using the LLM and stores the summary as a synthetic message row. The context window sent to the LLM is: system prompt + summary (if any) + most recent messages. Token-aware summarization is V2.

KTD8. **Terraform state in R2 using S3-compatible backend.** The R2 bucket used for Terraform state also holds the avatar glTF file and the fallback audio file. Credentials for the R2 backend are injected as GitHub Actions secrets. (session-settled: user-directed — chosen over Terraform Cloud)

KTD9. **GitHub Actions CI/CD: push to `main` triggers Wrangler deploy.** Secrets (Cloudflare API token, DeepInfra API key, Clerk publishable/secret keys) are stored in GitHub repo secrets and injected at deploy time. No credentials are committed to the repo. (session-settled: user-directed)

KTD10. **Inactivity auto-expiry: 30 minutes.** If the user has not sent a new voice message for 30 minutes, the next voice message starts a new conversation rather than continuing the existing one. The old conversation remains in history.

KTD11. **Display name is the only V1 user setting.** The Clerk-managed email/password profile is the auth identity; display name is stored per-user in D1 and editable from the app's settings UI.

KTD12. **Error fallback: pre-recorded audio clip.** When DeepInfra returns an error (network failure, rate limit, server error), the browser plays a pre-recorded fallback audio clip ("I'm having trouble connecting right now — please try again"). The clip is stored in R2 and served via the API Worker.

---

### Actors

A1. **Authenticated user** — a person given credentials by the operator; can access all post-login features.
A2. **Operator** — the app owner (the portfolio owner); provisions user credentials through Clerk, manages secrets through GitHub, deploys via CI/CD.
A3. **API Worker** — the Cloudflare Worker that proxies ASR, LLM, and TTS requests to DeepInfra and reads/writes D1.
A4. **DeepInfra** — the external AI service providing ASR (Whisper), LLM (chat completions), and TTS (hexgrad/Kokoro-82M or similar).
A5. **Clerk** — the external identity service managing sign-in/sign-up and issuing JWTs that A3 validates.

---

### Requirements

#### Authentication and Access

R1. The landing page is accessible without authentication. It contains a hero section with an animated visual (a preview or still of the 3D AI character) and a sign-in call-to-action.
R2. All routes other than the landing page redirect unauthenticated users to the Clerk sign-in flow.
R3. New accounts cannot self-register. The operator creates accounts manually via the Clerk dashboard. Sign-up UI may be present (Clerk default) but is not a supported user path.
R4. After successful sign-in, the user is redirected to the main application view.
R5. The API Worker validates the Clerk JWT on every request. Requests without a valid JWT receive a 401 response.

#### Landing Page

R6. The landing page hero contains an animated visual involving the 3D AI character and a sign-in button that launches the Clerk sign-in modal or page.
R7. The landing page is a static page served from Cloudflare Pages (no server-side rendering required for the landing page itself).

#### Main Application Layout

R8. The main application has a collapsible sidebar on the left and a primary canvas area on the right. The sidebar is open by default on desktop and closed by default on mobile.
R9. The primary canvas area displays the 3D AI character at full height as the centerpiece.
R10. A push-to-talk button is persistently visible in the canvas area. Its visual state reflects the current interaction state: idle, listening, speaking, processing, error.

#### Sidebar — Conversation History

R11. The sidebar lists all of the authenticated user's conversations, ordered by most recent activity, showing conversation title and relative timestamp (e.g., "Today", "Yesterday", "Sep 10").
R12. Tapping a conversation in the sidebar loads that conversation's state and makes it the active conversation. The character animates into idle state.
R13. Each conversation entry in the sidebar has a context menu (or inline actions) with two options: Rename and Delete.
R14. Rename opens an inline text field pre-filled with the current title. Saving commits the new title to D1.
R15. Delete removes the conversation and all its messages from D1. The action requires a confirmation prompt before execution.
R16. A "New Conversation" button is present at the top of the sidebar. Tapping it creates a new conversation and makes it active.
R17. If no conversations exist, the sidebar shows an empty state with a prompt to start speaking.

#### Conversation Behavior

R18. A new conversation is created automatically when: (a) the user taps "New Conversation", or (b) the first voice message arrives after 30 minutes of inactivity in the prior conversation (per KTD10).
R19. The conversation title is generated automatically by the LLM after the first exchange. The generated title is stored in D1 and displayed in the sidebar. If title generation fails, a default title ("New conversation") is used.
R20. No text transcript is shown in the main view during or after a conversation. The conversation is a pure voice experience. The sidebar is the only place conversation history is visible (as title + timestamp, not as readable message text).

#### Push-to-Talk Interaction

R21. Hold the push-to-talk button to record; release to send. Releasing always triggers submission.
R22. While recording, the browser captures audio as a Blob (WAV or MP3). A visual indicator (e.g., animated waveform or pulsing indicator) confirms that recording is active.
R23. On release, the recorded audio Blob is POSTed to the API Worker's `/api/chat` endpoint along with the current conversation ID and the user's Clerk JWT.
R24. While the API Worker is processing (ASR + LLM + TTS in sequence), the push-to-talk button displays a disabled state and the character displays the processing animation. The user cannot send another message during processing.
R25. If the user presses a stop/interrupt button while the character is speaking, audio playback stops immediately and the interaction returns to idle state. The interrupted exchange is stored in D1 as-is.
R26. After the audio response finishes playing, the interaction returns to idle state.

#### AI Response Pipeline (API Worker)

R27. The API Worker receives the audio Blob and conversation ID. It fetches the conversation's message history from D1 (recent messages, preceded by summary if one exists).
R28. The API Worker sends the audio Blob to DeepInfra ASR (Whisper). The transcript is stored as a user message row in D1.
R29. The API Worker sends the conversation context (system prompt + optional summary + recent messages) plus the new user transcript to the DeepInfra chat completions API. The full LLM response is collected before proceeding.
R30. The LLM response text is stored as an assistant message row in D1.
R31. The API Worker sends the LLM response text to the DeepInfra TTS API. The returned audio is streamed back to the browser as the HTTP response body.
R32. If any DeepInfra call fails (network error, non-2xx response, timeout), the API Worker returns a designated error response. The browser detects this and plays the fallback audio clip (per KTD12). The failed exchange is stored in D1 with an error annotation.

#### Summarization

R33. After storing a new assistant message in D1, the API Worker checks whether the conversation has crossed 20 non-summary messages. When the threshold is first crossed, summarization is triggered via `ctx.waitUntil()` (does not delay the HTTP response).
R34. Summarization sends the oldest 10 messages to the LLM with a summarization prompt. The result is stored as a synthetic `summary` role message. The 10 summarized messages are deleted from D1.
R35. When building the LLM context window (per R29), the API Worker includes: any existing summary message first, then remaining non-summary messages, capped at the model's safe context limit.

#### 3D Character

R36. The 3D character is a stylized full-body GLB avatar (futuristic outfit, 67-joint humanoid rig, 67 morph targets including all 15 ARKit `viseme_` targets) rendered using `avatoon` (React Three Fiber + Three.js + Drei) in the browser. Sourced from Wawa Sensei's open-source R3F avatar repository, the asset is pre-baked with all ARKit visemes and animations, requiring no Blender processing, and is served via Cloudflare R2 / CDN.
R37. The character transitions between four states: **idle** (breathing/floating idle loop), **listening** (subtle reaction while PTT is held), **processing** (thinking animation), **speaking** (lip-sync animation active).
R38. During speaking state, the browser plays the audio through the Web Audio API. An `AnalyserNode` reads FFT frequency data in real time, maps it to ARKit viseme weights, and updates the avatar's blend shape morph targets each animation frame.
R39. The idle animation includes continuous subtle motion (e.g., gentle floating, eye blinks, head micro-movements). Random idle behaviors (e.g., head tilt, glance, posture shift) trigger at unpredictable intervals.

#### Settings

R40. A settings panel is accessible from a persistent icon in the UI.
R41. The settings panel contains one editable field: Display Name. Saving updates the value in D1 for the authenticated user.

#### Infrastructure and Operations

R42. All infrastructure is declared in Terraform. Provisioned resources include: R2 bucket (Terraform state + static assets), D1 database, Cloudflare Worker (API Worker), Cloudflare Pages project (frontend).
R43. No credentials are hardcoded in the repository. All secrets (Cloudflare API token, DeepInfra API key, Clerk keys, R2 backend credentials) are stored as GitHub Actions secrets and injected at deploy time.
R44. A push to `main` triggers: (1) `terraform apply`, (2) `wrangler deploy` for the API Worker, (3) Cloudflare Pages build and deploy for the Next.js frontend.
R45. D1 schema is managed via migration files in the repository. Migrations run automatically in CI/CD before Worker deploy.

---

### Key Flows

- F1. **First-time sign-in**
  - **Trigger:** User navigates to the landing page and taps the sign-in CTA.
  - **Actors:** A1, A5
  - **Steps:** Clerk modal/page opens → user enters credentials → Clerk issues JWT → user is redirected to main app → idle 3D character displayed → sidebar shows empty state if no prior conversations.
  - **Covers:** R1, R2, R4, R6

- F2. **Push-to-talk conversation turn**
  - **Trigger:** User holds the push-to-talk button and releases.
  - **Actors:** A1, A3, A4
  - **Steps:** Browser records audio → user releases → audio Blob POSTed to API Worker with JWT and conversation ID → Worker validates JWT → fetches D1 context → sends audio to DeepInfra ASR → transcript stored in D1 → sends context + transcript to DeepInfra LLM → response text stored in D1 → sends response text to DeepInfra TTS → audio returned in HTTP response → browser plays audio via Web Audio API → lip-sync active via AnalyserNode → character enters speaking state → returns to idle on completion.
  - **Covers:** R5, R21–R31, R36–R38

- F3. **Interruption during AI response**
  - **Trigger:** User presses the stop/interrupt button while character is speaking.
  - **Actors:** A1
  - **Steps:** Browser stops audio playback immediately → pending response body download is aborted → interaction state returns to idle → PTT button becomes available.
  - **Covers:** R25, R26

- F4. **Auto-create new conversation after inactivity**
  - **Trigger:** User sends a voice message after 30 minutes of inactivity.
  - **Actors:** A1, A3
  - **Steps:** API Worker checks last message timestamp → >30 minutes elapsed → Worker creates new conversation record in D1 → new conversation becomes active → turn proceeds normally (F2) in the new conversation.
  - **Covers:** R18, KTD10

- F5. **Rename conversation**
  - **Trigger:** User opens sidebar context menu and taps Rename.
  - **Actors:** A1, A3
  - **Steps:** Inline text field appears pre-filled with current title → user edits and confirms → PATCH request sent to API Worker → title updated in D1 → sidebar reflects new title.
  - **Covers:** R14

- F6. **Summarization (background)**
  - **Trigger:** After storing the 20th non-summary message in a conversation.
  - **Actors:** A3, A4
  - **Steps:** API Worker triggers summarization via `ctx.waitUntil()` → fetches oldest 10 messages → sends to LLM for summarization → stores summary row in D1 → deletes the 10 summarized message rows.
  - **Covers:** R33–R35, KTD7

---

### Acceptance Examples

- AE1. **PTT blocked during processing.**
  - **Covers:** R24
  - **Given:** The user has released PTT and the API Worker is processing.
  - **When:** The user attempts to press PTT again.
  - **Then:** PTT button is visually disabled; no recording starts; user must wait.

- AE2. **Interruption returns to idle.**
  - **Covers:** R25
  - **Given:** The character is speaking.
  - **When:** The user presses the interrupt button.
  - **Then:** Audio stops within one animation frame; character transitions to idle; PTT becomes available; no new API call is made.

- AE3. **Fallback audio on API error.**
  - **Covers:** R32, KTD12
  - **Given:** DeepInfra returns a 503 during the TTS call.
  - **When:** The API Worker returns an error response.
  - **Then:** Browser plays the pre-recorded fallback clip from R2; character animates through speaking state for the clip's duration.

- AE4. **Inactivity creates new conversation.**
  - **Covers:** R18, KTD10
  - **Given:** Last message in the active conversation was sent 35 minutes ago.
  - **When:** The user releases PTT to send a new voice message.
  - **Then:** A new conversation is created; prior conversation appears unchanged in the sidebar; new conversation becomes active.

- AE5. **Summarization does not delay response.**
  - **Covers:** R33, KTD7
  - **Given:** A conversation has exactly 20 non-summary messages and the user sends message 21.
  - **When:** The API Worker processes turn 21.
  - **Then:** The audio response is returned to the browser before summarization begins; summarization runs in `ctx.waitUntil()` without measurable impact on perceived response time.

- AE6. **History persists across sessions.**
  - **Covers:** R11, R12
  - **Given:** A user has a conversation with 5 exchanges, then closes the browser.
  - **When:** The user opens the app in a new session and authenticates.
  - **Then:** The prior conversation appears in the sidebar; tapping it makes it active; the character is in idle state (prior audio is not replayed).

- AE7. **Delete requires confirmation.**
  - **Covers:** R15
  - **Given:** A user has multiple conversations in the sidebar.
  - **When:** The user selects Delete from the context menu.
  - **Then:** A confirmation dialog appears. Confirming removes the conversation and all messages from D1 and from the sidebar. Cancelling leaves data unchanged.

---

### Success Criteria

SC1. A visitor watching someone use Flare for 30 seconds identifies it as technically impressive — the character, lip-sync, and voice interaction feel cohesive and polished, not prototype-quality.
SC2. The full infrastructure can be reproduced from a clean Cloudflare account using `terraform apply` + `wrangler deploy` with no manual console steps beyond initial secret setup.
SC3. The API Worker stays within Cloudflare Free tier CPU limits (10ms CPU per request); the majority of wall-clock time is spent on DeepInfra network calls.
SC4. A conversation turn (PTT release → audio starts playing) completes in under 8 seconds on a typical broadband connection (ASR ~1s, LLM ~2–4s, TTS ~1–2s, overhead ~1s).
SC5. Conversation history is durable across browser sessions and devices for the same Clerk-authenticated user.

---

### Scope Boundaries

**Deferred for later (V2+):**
- Text input alongside voice
- Voice activity detection (VAD) — auto-send on silence
- WebSocket persistent connections for lower-latency turns
- LLM-controlled animations (emotions, gestures keyed to response content)
- TTS voice selection per user
- Per-user persona or system prompt customization
- Streaming-per-sentence TTS pipeline
- Audio replay / re-generation of prior AI responses
- Custom domain
- Staging / preview deployment environment
- Per-user rate limiting
- Full-text conversation search

**Outside this product's identity:**
- Self-serve sign-up
- Text-only chat mode (the product is voice-first by definition)
- Mobile-native app
- Multi-user or collaborative sessions

---

### Dependencies and Assumptions

- Clerk free tier provides sufficient MAUs for an invite-only showcase (100 MAU limit on free tier).
- DeepInfra is assumed to have acceptable uptime for a non-production showcase. The fallback audio handles transient failures.
- The Cloudflare Workers Free tier 10ms CPU limit is not violated because the API Worker performs no CPU-intensive computation — all heavy work is offloaded to DeepInfra via `fetch()` calls, which do not count against CPU time.
- The stylized full-body GLB avatar with ARKit `viseme_` morph targets is sourced from Wawa Sensei's open-source R3F repository ([github.com/wass08/r3f-virtual-girlfriend-frontend](https://github.com/wass08/r3f-virtual-girlfriend-frontend), `64f1a714fe61576b46f27ca2.glb`, saved as `models/avatar.glb`) and paired with `animations.glb`. ARKit shape keys are already pre-baked into the model, requiring no Blender authoring. The file is uploaded once to R2 and served via CDN. This is an operator task and is not automated by CI/CD.
- The fallback audio clip must be created (TTS-generated or recorded) and placed in R2 before launch. This is an operator task and is not automated by CI/CD.
- DeepInfra ASR (Whisper) accepts multipart audio upload from a Cloudflare Worker. The Worker streams the audio Blob to DeepInfra without buffering the full body in memory.

---

### Sources and Research

- Cloudflare Workers Free tier limits — 10ms CPU limit applies to CPU time only; `fetch()` wait time excluded. HTTP request duration unlimited while client is connected. 100K requests/day free. Source: [developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/)
- DeepInfra TTS — ElevenLabs-compatible endpoint `POST /v1/text-to-speech/{voice_id}/stream`; default model `hexgrad/Kokoro-82M`; output formats mp3/wav/pcm; no phoneme data in response. Source: [docs.deepinfra.com/apis/text-to-speech](https://docs.deepinfra.com/apis/text-to-speech.md)
- DeepInfra ASR — Whisper multipart upload `POST /v1/inference/openai/whisper-large-v3`; accepts mp3/wav; returns transcript + per-segment timestamps. Source: [docs.deepinfra.com/apis/speech](https://docs.deepinfra.com/apis/speech.md)
- `avatoon` — MIT-licensed, npm-installable React Three Fiber component for rendering animated 3D GLB avatars with real-time ARKit viseme morph-target lip-sync, head motion, and eye-blink. Peer deps: `@react-three/fiber`, `@react-three/drei`, `three`. Source: [github.com/khaledalam/avatoon](https://github.com/khaledalam/avatoon). Note: `@readyplayerme/visage` is abandoned following RPM's shutdown (January 31, 2026).
- 3D Avatar Asset & Animations — Pre-rigged full-body GLB avatar with 67 ARKit blendshapes and companion animation suite. Sourced from Wawa Sensei's open-source React Three Fiber companion project: [github.com/wass08/r3f-virtual-girlfriend-frontend](https://github.com/wass08/r3f-virtual-girlfriend-frontend) (`public/models/64f1a714fe61576b46f27ca2.glb` and `public/models/animations.glb`).
- Animation Download Sources for this Avatar Model:
  - **Ready Player Me Animation Library**: [github.com/readyplayerme/animation-library](https://github.com/readyplayerme/animation-library) — official repository of pre-rigged humanoid animations (free for personal and commercial use on RPM avatars).
  - **Ready Player Me GLB Animation Collection**: [github.com/crazyramirez/babylonjs-ReadyPlayerMe-Animation-Combiner](https://github.com/crazyramirez/babylonjs-ReadyPlayerMe-Animation-Combiner) (`resources/models/animations/femenine/`) — pre-converted, optimized GLB animation clips (locomotion, running, walking, jumping, dancing, and gestures) mapped directly to this 67-joint armature.
  - **Adobe Mixamo**: [mixamo.com](https://www.mixamo.com) — 2,500+ free mocap animations compatible with this standard humanoid armature (royalty-free for personal and commercial applications).
- Web Audio API `AnalyserNode` — browser-native FFT analysis of playing audio for real-time viseme approximation; no external phoneme service required.
- Cloudflare R2 S3-compatible Terraform backend — uses `s3` provider with `endpoint`, `access_key`, `secret_key`, `bucket`, `region = "auto"`, `skip_credentials_validation = true`.
