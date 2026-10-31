# Mobile App: Web Parity Implementation Plan (Agent-Driven with Argent)

Goal: bring the Xemora mobile app (`mobile/App`, Expo) to the same feature level as the web app (`web/`), with AI agents building and testing it on a device through Argent, so the developer does not paste logs, errors or screenshots by hand.

Status (2026-10-25): Phases 0, 1 and 2 are done, slice 1 (auth) is done, the backend security hardening is done, and Step 0 (account hardening) is built and reviewed on branch `mobile-parity/hardening-passwords`, waiting for a decision before merging. Everything else is merged locally into branch `mobile-parity/phase-0-setup` (nothing is pushed). Read "START HERE" below before doing anything.

Related: `README.md` (product overview), `new and current voice identity auth implementation_plan.md` (voice login, already live on web), `docs/background-completion-phase-*.md` (tasks and push design).

---

## START HERE (handoff, updated 2026-10-25)

Audience: a developer or an AI agent starting work on this project with no memory of earlier sessions. Read this section, then continue with "Step 1" (Step 0 is built and waiting for a decision, see D).

Note on provenance: this section was restored on 2026-10-25 from the text read at the start of that session, after the file on disk was found reverted to an older version. Check it against the code if something looks off.

### A. Where things stand

| Area | State |
| :--- | :--- |
| Phase 0 (environment) | Done. Emulator, local database, local backend, Metro and Argent all work (sections 8.4 to 8.6). |
| Phase 1 (audit) | Done. Findings are in `docs/mobile-parity.md` (untracked on purpose; the developer asked not to commit it yet). |
| Phase 2 (foundation) | Done. Session handling for Apollo 4, type errors 85 to 0, ESLint errors 0, template code removed, honest Home, status bar fixed, Voice crash fixed, two Argent regression flows (section 8.7). |
| Slice 1 (auth) | Done and independently reviewed: sign-up password rule matches the backend, Change password screen, wrong-password handling. |
| Backend hardening | Done and reviewed: users/chat/image/voice authorization, role in token, live account lookup per request, JWT secret with no fallback, voice webhook secret, wrong current password is `BAD_USER_INPUT`. |
| Web fix | Done: an expired session goes to login immediately. |
| Step 0 (account hardening) | Done, reviewed and merged into `mobile-parity/phase-0-setup` on 2026-10-25 (section 8.8). Open subscriptions are closed and the change is audit-logged. |
| Slice 2 (chat replies) | Done, reviewed and merged (section 8.9). Decisions still open: provider-failure reply, idempotent Retry. |
| Slice 3a (AI tasks list, T1/T2) | Done, reviewed and merged locally (section 8.10). |
| Slice 3b (push, T3/T4) | Deferred to the end by decision, built with Expo Push (section 8.10). |
| Slice 5a (voice text tools) | Built, reviewed and merged locally (section 8.12). Voice cloning and recording are a later slice (5b). |
| Slice 4 (image generation) | Built, reviewed and merged locally (section 8.11). Live generation verified after the provider was topped up (2 pollen on 2026-10-25). |
| Scope decision | Core first: slices 1 to 6 (section 3). Biometrics, security center and playground come later. |
| Android package id | `com.xemora.app` (changed from the template id; reinstall the dev app after a rebuild). |

Branches (all local): `mobile-parity/phase-0-setup` is the integration branch and holds everything above except Step 0. Work on a new branch off it, one per slice or task, and merge back with a fast-forward after review. Side branches such as `fix/*`, `mobile-parity/phase-2-foundation` and `mobile-parity/slice-1-auth` are already merged and can be deleted.

Uncommitted on purpose or not yet decided: this plan file, `docs/mobile-parity.md`, and `.claude/` (the Argent agent rules; decision 6 in section 6).

### B. Set up the environment (in this order)

1. Docker Desktop must be running (it is a user service: `systemctl --user start docker-desktop`), then `docker start xemora-dev-postgres xemora-dev-redis` (they normally come back by themselves).
2. Backend on port 4001 against the LOCAL database, always through the guard script: `cd backend && ./scripts/local-env.sh npm run dev`. For the expiry flow only, prefix `JWT_EXPIRES_IN=60s`.
3. Emulator: `emulator -avd Xemora_Pixel_API_35 -gpu host -no-audio` (the SDK tools are in `~/Android/Sdk/platform-tools` and `~/Android/Sdk/emulator`).
4. Metro on port 8082: `cd mobile/App && npx expo start --dev-client --port 8082`, then `adb reverse tcp:8082 tcp:8082`.
5. Native rebuild only after native dependency or `app.json` changes. Preferred (2026-10-25): `cd mobile/App/android && ./gradlew app:installDebug -PreactNativeArchitectures=x86_64` (about 3 minutes; autolinking picks up new libraries, no `prebuild --clean` needed). After a fresh install the debug app looks for Metro at `10.0.2.2:8081`; set `debug_http_host` to `localhost:8082` (see the memory file `mobile-dev-environment.md`).
6. Argent tools must be connected. The MCP entry in `~/.claude.json` uses the absolute path `/home/amos/.npm-global/bin/argent` with an explicit Android `PATH`. If the tools are missing, reconnect with `/mcp` or restart the session. The test account is `agent-test@xemora.local`; its password is the Argent secret `XEMORA_TEST_PASSWORD` (type it with `{{secret:XEMORA_TEST_PASSWORD}}`; never print or paste it).

How to run long-lived processes safely: start the backend, Metro and the emulator with the Bash tool's `run_in_background` and stop them with `TaskStop` by task id. Never detach with `setsid` and then kill a PID or its parent: the parent of a detached process is the user's systemd manager, and killing it ends the whole desktop session (this happened once). Never `pkill -f` a pattern that also appears in your own command line.

### C. Checks to run before calling anything done

- Mobile (`cd mobile/App`): `npx tsc --noEmit`, `npx eslint "**/*.{js,jsx,ts,tsx}"`, `npx prettier -c .`, `npm test` (session and validation unit tests).
- Backend (`cd backend`): `npx tsc --noEmit`, `./scripts/local-env.sh npm run test:authz`, `npm run test:tasks`.
- Device: the two Argent flows in `mobile/App/.argent/flows/`, each run twice in a row with `flow-execute` (or `argent flow run <name> --platform android`): `qa-auth-signin-home-signout` and `qa-auth-session-expiry-signout` (the second needs the backend started with `JWT_EXPIRES_IN=60s`; restart it normally afterwards).
- Independent review with the `reviewer-opus-medium` agent for anything touching auth, personal data, uploads, push or money; pass it the requirement and the commit ids, tell it to read with `git show`, and fix what it finds before merging.
- Commits: no git identity is configured, so use `git -c user.name=AmosQuety -c user.email=amosnabasa4@gmail.com commit ...` (one-off, no config change). Small commits, test first, formatting changes in their own commit. Do not push.

### D. Step 0: account hardening (BUILT, see section 8.8)

Three items from the independent reviews, done on branch `mobile-parity/hardening-passwords` off `mobile-parity/phase-0-setup`:

- **D1 maximum password length:** new passwords capped at 72 UTF-8 bytes (bcrypt keeps only the first 72), enforced in the backend `register` and `changePassword` (`BAD_USER_INPUT`), mirrored in mobile and web with a hint; login is not capped. Web sign-up minimum fixed from 6 to 8.
- **D2 screenshot blocking:** `expo-screen-capture` (Android `FLAG_SECURE`) while sign-in, sign-up and change-password are focused. Argent screenshots still work on them, so it is on in all builds.
- **D3 end other sessions on password change:** every token carries a keyed fingerprint (`pwf`) of the password hash, checked on each request; `changePassword` returns a fresh token so the changing device stays signed in. Everyone signs in once after this ships.

Merge status: merged into `mobile-parity/phase-0-setup` (fast-forward) on 2026-10-25 after the developer approved the recommendations. Review finding 1 was resolved by closing the user's open WebSocket subscriptions (code 4401) when the password changes, and password changes are written to `securityAuditLog` (`PASSWORD_CHANGED`, no secret). Remaining: announce the one-time sign-out at release. The session-expiry flow was re-run on 2026-10-25 against a backend started with `JWT_EXPIRES_IN=60s` and passed twice in a row; the backend was then restarted normally (7-day tokens, checked from a token's lifetime).

### E. Step 1: slice 2, chat replies (DONE, see section 8.9)

Status (2026-10-25): built, verified on the emulator, reviewed and merged. Open decisions are listed in section 8.9. The plan below is kept for reference.

Facts already established (do not re-investigate):
- The backend and Gemini path works. One test request to `sendMessageWithResponse` returned an AI reply, so quota and keys are fine.
- Mobile "New chat" (`mobile/App/app/features/chats/new.tsx`) calls only `createChat` with the first message inside it, then navigates. It never asks for a reply, which is why a new chat gets no answer.
- Do NOT copy web's approach: the backend `createChat` stores the seeded message and `sendMessageWithResponse` stores the user message again, so web saves the first message twice and the model sees it twice.

Plan:
1. `new.tsx`: create the chat with `messages: []` and a title of the first 40 characters of the message (as web does). Navigate to `/features/chats/<id>` passing the first message as a route parameter.
2. `app/features/chats/[id].tsx`: send that first message exactly once (a ref guard against re-renders), show a "thinking" state, then the reply. Add a clear failure state with a Retry for network errors and quota. Never double-send.
3. Backend: `sendMessageWithResponse` throws `AuthenticationError("Unauthorized")` when the chat is not the caller's. Clients sign the user out on that code. Change it to `UserInputError("Chat not found")` (same style as `backend/src/auth/chatAccess.ts`) with a test. Check the other chat and message mutations that use `AuthenticationError` for ownership and fix them the same way.
4. Chat list: select only the chat fields it needs (audit finding F-12) instead of every message of every chat.
5. Tests: unit tests for the pure parts (title from message, send-once guard); an Argent flow `qa-chat-new-conversation-reply` that starts a chat, waits for the reply, then deletes that chat from the list so the next run starts clean (it makes one real Gemini call per run). Record it with `flow-start-recording` before touching the app, as `argent-qa-flows` requires.
6. Review: a normal independent review (user message content goes to a third party).

Out of scope for this slice: document upload for RAG (needs a multipart upload link on mobile, audit finding F-02; do it as its own slice 2b); "delete message" (web defines it but never uses it, so it is not a parity gap). An optional web fix: in `web/src/components/chat/ChatContainer.tsx` (around line 458) create the chat with `messages: []` to stop the double save.

### F. After that

Slices 3 to 6 follow the table in section 3 (tasks and push, image generation, voice lab, profile and settings), each on its own branch with the per-slice loop in section 3. Phase 4 (hardening: profiling, slow-network and offline checks, accessibility, full regression run) comes last.

Open items that need the developer, not an agent:
- Deployment: set `JWT_SECRET` (32+ characters, unique) and `WEBHOOK_SECRET` (16+ characters) in every deployed environment; check row-level security on the live Supabase project (`dvdlspbbiwqccqwushff`; the query is in `docs/mobile-parity.md`). After Step 0 ships, every user is signed out once.
- Step 0 decisions listed in D.
- Whether to commit this plan, `docs/mobile-parity.md` and `.claude/`, and when to push anything.
- Argent 0.30.1 is available (0.28.0 installed); update only with the developer's explicit consent.
- `expo-sqlite` is now unused (still in `package.json` and the `app.json` plugins), and three stray note files with content were left alone (`mobile/App/new.txt`, `mobile/App/app/features/chats/image and file.txt`, `mobile/App/app/features/voice/.txt`).
- Web: `web/package-lock.json` is out of sync with `package.json` (`npm ci` fails), web has no test runner and no installed dependencies here.

### G. Working rules (short)

- The developer decides; agents propose, implement, test and report. Do not silently change requirements, shared platform code or backend contracts: propose, explain, wait.
- State a short plan before non-trivial changes, write the failing test first, and keep commits small. Do not weaken a test to get green.
- Use Argent tools for all device work, with `list-devices` first. Take tap coordinates from the element tree, never from screenshot pixels. Type credentials only with `{{secret:NAME}}`; put the typing and the submit in one `run-sequence`.
- Never print, log or commit secrets (including `backend/.env`, `backend/.env.local`, `~/.argent/secrets.env`).
- Delegate to the named pinned agents (`worker-*`, `reviewer-opus-medium`) chosen with the `model-routing` skill. Workers often run out of turns before reporting: tell them to write their output file early, give a precise acceptance check, and verify their claims yourself.
- The emulator's Play Store can update the system WebView in the background and kill the app mid-run, and the emulator process can also die between runs. If a flow fails with the device offline or the app gone, check `adb devices` and `adb logcat` (`installPackageLI`) before suspecting the app.
- Do not use `git stash` on this repository while the plan file or `docs/mobile-parity.md` hold uncommitted work, and avoid two sessions editing the plan file at once (it was found reverted on 2026-10-25).
- Record what you did in this file (section 8.7 and 8.8 style) so the next person or agent can start from it.

---

## 1. Current state (verified on this machine)

### 1.1 PC

| Item | Finding | Impact |
| :--- | :--- | :--- |
| CPU / RAM | Intel Core Ultra 7 265U, 14 threads, 30 GB RAM, but only about 6.5 GB available | Emulator will be starved unless memory is freed |
| Memory use | Docker Desktop VM holds 7.7 GB (5 containers: `authhub-*` and `oracle-db`, an unrelated project); browsers and IDE take the rest | Stop unrelated containers while working |
| Disk | 384 GB free | Fine |
| Virtualization | VT-x present, `/dev/kvm` exists, user `amos` is in the `kvm` group | Hardware-accelerated Android emulator works |
| OS | Linux, GNOME | No iOS simulator is possible. Android only. |
| Node / npm | Node 22.22.1, npm 9.2.0; global prefix `~/.npm-global` | OK (the earlier EACCES problem is fixed) |
| Java | `jenv` default is JDK 21 (also 1.8 and 21 installed) | RN 0.79 officially targets JDK 17; 21 usually works. Verify at first build, install 17 if Gradle complains |
| Android Studio | Installed (snap) | OK |
| Android SDK | `~/Android/Sdk` has: emulator, platform-tools, platform `android-37.0`, build-tools 36.0.0, one system image (API 37, Play Store, x86_64) | See gaps below |
| AVD | One: `Medium_Phone` (API 37, 2 GB RAM, 1080x2400) | API 37 is newer than Expo SDK 53 / RN 0.79 target (API 35); 2 GB RAM is low |
| Running device | None. `adb devices` is empty (I started the adb daemon while checking) | Agent must boot it |
| Env vars | `ANDROID_HOME` unset; `adb` and `emulator` not on PATH | Argent and Gradle need them |

Android SDK gaps for a native build of Expo SDK 53 (RN 0.79): platform 35, build-tools 35.0.0, NDK 27.x, CMake 3.22.1, and the command-line tools (`sdkmanager` is missing). The licenses folder looks incomplete.

### 1.2 Argent

- Installed globally (v0.28.0) in `~/.npm-global/bin`; skills `argent-*` are present; `.claude/claude.md` (untracked) already tells agents to verify UI via Argent and read Metro logs.
- **The MCP server failed to connect in the last session: `Executable not found in $PATH: argent`.** Cause: the MCP entry runs bare `argent`, but VS Code was started from the desktop, which never loads `~/.bashrc`, so `~/.npm-global/bin` is not on its PATH. The same problem will hide `adb` and `emulator` from Argent.
- Until this is fixed no agent has any device access. This is the first thing to fix.

### 1.3 Workspace

- Git: branch `master`, clean except untracked `.claude/`. Recent work: branding and SEO merged.
- Backend (`backend/`, port 4001): uses cloud services only. Supabase Postgres (pooler), Upstash Redis, and the AI engine hosted on a Hugging Face Space. `backend/.env` exists. No local Postgres, Redis or FaceSearch is needed.
- `node_modules` is missing in `backend/`, `web/` and `packages/ai-orchestrator` (the orchestrator is also unbuilt). Mobile `node_modules` was rebuilt on 2026-10-15 and is fine.
- Port 8081 (Metro default) is taken by the `authhub-frontend` Docker container. Use another Metro port or stop the container.
- LAN IP is now `10.76.246.91`; mobile `libs/environment.ts` hardcodes a stale `10.200.39.213`. An Android emulator reaches the host at `10.0.2.2`.
- I cannot tell from config alone whether `DATABASE_URL` is a development or production database. Agents will create test users, chats and uploads, so this must be decided (see section 6).

### 1.4 Mobile app baseline

- About 3,200 lines. Screens: email sign-in/sign-up, chat list / new chat / chat detail, a 935-line voice screen, a 12-line image stub, and template tabs (`items`, `profile`).
- GraphQL coverage: mobile declares **11** operations, web uses **43** (about 26 percent).
- Health: `tsc --noEmit` reports **85 errors** (41 in `services/api.ts`). `expo-doctor` fails 5 checks: invalid `ios.adaptiveIcon` in `app.json`, missing peers (`expo-font`, `expo-linking`), mismatched `@expo/config-plugins` and `@expo/metro-config`, RN Directory metadata warnings, and outdated pins (`expo` 53.0.23 vs ~53.0.27, `react-native` 0.79.5 vs 0.79.6, `expo-router`, `expo-constants`, `@react-native-community/slider`).
- Config smells: `nativewind` pinned to `latest` (4.2.1 installed); both `@react-native-voice/voice` and `@react-native-community/voice` are listed; Android package id is still the template value `com.danyrivas13.AppDeliveryReactNative`; `libs/config.ts` holds placeholder URLs; no push-notification package; no `scheme` for deep links.
- A **development build** (`expo prebuild` and `expo run:android`) is used instead of Expo Go, because later slices need native modules Expo Go lacks (push via `expo-notifications`, camera, speech input). Correction: the voice screen itself uses only `expo-speech`, `expo-file-system` and `expo-sharing`; the `@react-native-voice/voice` package was never imported.

---

## 2. Parity gap (to be verified in Phase 1)

Derived from operation names and file names, not yet from behavior.

| Area | Web | Mobile today | Missing on mobile |
| :--- | :--- | :--- | :--- |
| Auth | Email, Face login, Voice login (challenge-response), register, change password | Email, Face login | Voice login (`GetVoiceLoginChallenge`, `LoginWithVoice`), change password, face/voice enrolment |
| Chat | Chats, history, delete message, Gemini content, document upload and lifecycle, context panel | List, create, send, history | Delete message, document upload (RAG) and status, context panel |
| Tasks and push | Recent AI Tasks panel, push subscribe / unsubscribe / engagement | None | `GetMyTasks`, `GetTask`, push (needs `expo-notifications`) |
| Image | Generate, variants, status, gallery | Stub | All |
| Voice | Voice Lab: clone, translate, summarize, job status | Large on-device screen, no backend voice operations declared | Backend voice jobs (verify what the screen really does) |
| Playground | Magic Mirror, Twin-O-Meter, Crowd Scanner (FindMe), characters, workspaces, games | None | All (camera and image pick needed) |
| Security | Security center and audit logs | None | `GetSecurityAuditLogs` view |
| Personalization and settings | Blaze settings, preferences, face/voice/push settings, profile, users | Profile tab (basic) | `UpdatePreferences`, settings screens, users |

---

## 3. Phased plan

### Phase 0: Make the agent self-sufficient (environment)

Exit test: with no human input, an agent boots the emulator, launches the dev build, takes a screenshot with Argent, reads Metro logs, and logs in against the backend.

0.1 Free resources (developer's call): stop unrelated containers, for example `docker stop oracle-db authhub-app authhub-frontend authhub-redis authhub-postgres`. This frees about 5 GB and port 8081.

0.2 Fix PATH for GUI-launched apps so Argent, `adb` and `emulator` resolve. Recommended (survives reboots; works on Wayland): create `~/.config/environment.d/10-dev-paths.conf`:
```
ANDROID_HOME=${HOME}/Android/Sdk
PATH=${HOME}/.npm-global/bin:${HOME}/Android/Sdk/platform-tools:${HOME}/Android/Sdk/emulator:${PATH}
```
Then log out and in, and restart VS Code. Quick alternative without re-login: quit VS Code fully and start it from a terminal with `code .`. Last resort: register the MCP with an absolute path (`/home/amos/.npm-global/bin/argent mcp`).

0.3 DONE 2026-10-17 (installed from the command line; licenses accepted). Android SDK components:  Command-line Tools (latest), Platform 35, Build-Tools 35.0.0, NDK 27.1.12297006, CMake 3.22.1; installed and verified with `sdkmanager --list_installed`.

0.4 DONE 2026-10-17. Created AVD `Xemora_Pixel_API_35` (Pixel 8 profile, API 35, `google_apis_playstore` x86_64, 4 GB RAM, host GPU, Play Store on). Created but not yet booted. The API 37 AVD `Medium_Phone_API_37.0` is kept but must not be used for this project.

0.5 DONE. Install and start the backend: `npm install` in `packages/ai-orchestrator` (build) and `backend`, then `npm run dev` (port 4001). Check a GraphQL query responds.

0.6 DONE. Make mobile config environment-driven: read `EXPO_PUBLIC_GRAPHQL_URL` and friends from a gitignored `.env`; default development to `http://10.0.2.2:4001/graphql`. Remove hardcoded IPs and placeholder URLs.

0.7 DONE (see section 8 for what changed). Mobile toolchain hygiene (one small branch): run `npx expo install --check`, fix `app.json` schema errors, add missing peers, pin `nativewind`, remove the duplicate voice package, set the real Android package id (confirm the value first). Decision: commit the generated `android/` folder or keep it ignored and regenerate (see section 6).

0.8 DONE. First dev build: `npx expo prebuild --platform android` then `npx expo run:android --port 8082`. Fix any JDK 21 or Gradle issue (fall back to JDK 17 via `jenv` if needed).

0.9 DONE 2026-10-17. `argent-environment-inspector` ran once and its findings are in project memory. Exit test passed: emulator booted, app launched, screenshot taken, Metro logs read, login as `agent-test@xemora.local` reached the local backend (details in section 8.6).

### Phase 1: Parity audit (read-only, agent)

- Run the `code-reviewer` workflow on `mobile/App` and the web feature set.
- Produce `docs/mobile-parity.md`: per web feature, mobile status (missing, partial, done), GraphQL operations, native approach, effort, and risk class.
- Walk every current mobile screen on the device with Argent and record what actually works (tests the section 2 assumptions).
- Developer reviews and sets priority order. No building before sign-off.

### Phase 2: Foundation (one branch)

- Get `tsc --noEmit` to zero errors (start with `services/api.ts`); ESLint and Prettier clean.
- Remove template code (`items` tab, `.txt` scratch files in `app/`).
- Establish the shared UI kit and navigation. Check `/home/amos/dev/react/ui-webapp-framework` (`develop` branch, read-only) and web design tokens before styling; follow the `design-system` skill.
- Auth/session foundation: token in `expo-secure-store`, Apollo error link and 401 handling, shared GraphQL operations kept in sync with web.
- Add one Argent regression flow: launch, login, reach home.

### Phase 3: Feature slices (one branch per slice, sequential on the device)

Suggested order (adjust after Phase 1):

| # | Slice | Web source | Notes | Review level |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Auth and session | `Login.tsx`, `Register.tsx` | Password change, logout, token expiry | Independent review (auth) |
| 2 | Chat and documents | `ChatContainer.tsx`, `DocumentUploader.tsx` | Delete message, upload, lifecycle status | Review (user files) |
| 3 | Tasks and push | `RecentTasksPanel.tsx`, `push.ts` | Add `expo-notifications`; push is best-effort, recovery from Recent Tasks (per `docs/background-completion-phase-6`) | Review (personal data) |
| 4 | Image generation | `ImageGenerator.tsx` | Replace stub; gallery and status polling | Standard |
| 5 | Voice lab | `VoiceLab.tsx`, `VoiceTools.tsx` | Decide on-device vs backend jobs | Standard |
| 6 | Profile and settings | `ProfilePage.tsx`, `SettingsPage.tsx`, `BlazeSettingsPage.tsx` | Preferences | Standard |
| 7 | Biometrics | `FaceCapture.tsx`, `VoiceCapture.tsx`, `VoiceLogin.tsx` | Face and voice enrol/login, challenge-response; follow the voice identity plan | Independent review (biometric auth) |
| 8 | Security center | `SecurityPage.tsx` | Audit logs, read-only | Review (audit data) |
| 9 | Playground | `components/playground/*` | Camera and image pick; games last | Standard |

Per-slice loop (agent does all of it, no pasted output needed):
1. State a short plan (files, approach, risks); read the matching web code and backend schema first.
2. Write a failing test where practical, then implement.
3. Run the app on the emulator via Argent: tap through the flow, screenshot, read Metro logs and use `debugger-component-tree` / `debugger-evaluate` for runtime errors. Fix and repeat.
4. Record the flow as an `argent-qa-flows` regression test; it must pass twice in a row.
5. Run `tsc --noEmit`, ESLint, Prettier and tests; produce the rigorous-testing self-audit (covered / not covered / uncertain).
6. Commit on the slice branch only. Merge after developer review.

Done for a slice = behavior matches web for the agreed acceptance list, two clean flow passes, zero type/lint errors, self-audit written, review findings addressed.

### Phase 4: Hardening

- Profile with `argent-react-native-profiler`; fix confirmed re-render and startup issues (measure first).
- Slow-network and offline checks (Uganda connectivity); retry-safe requests; no optimistic UI on financial actions (not expected here, but keep the guardrail).
- Accessibility pass: contrast, focus order, touch targets, screen reader labels.
- Full regression run of all flows; update this plan and `README.md`.

---

## 4. How the agents work

- **One device, one driver.** Only one agent controls the emulator at a time. Code-writing sub-agents may work in parallel on separate branches or worktrees, but UI verification is serialized.
- **Roles.** Orchestrator (main session) plans and integrates; a worker per slice implements; the `argent-environment-inspector` runs once; `reviewer-opus-medium` reviews slices touching auth, biometrics, personal data, uploads and push. Worker model and effort are chosen per slice with the `model-routing` skill; auth and biometrics start at `worker-opus-medium`.
- **Rules.** `.claude/claude.md` and `~/.claude/rules/argent.md` apply: use Argent tools for all device work (no raw `adb` UI taps), call `list-devices` first, read the matching `argent-*` skill before each workflow, never ask the developer for terminal output while Metro logs are available, and call `stop-all-simulator-servers` scoped to the devices used when finished.
- **Safety.** Branch per slice, no commits to `master`, no force-push, no schema or backend contract changes without approval, secrets never printed or committed (including `backend/.env`).
- **Shared platform.** Anything that looks like it belongs in Common UI or `packages/` is proposed to the developer, not changed.

---

## 5. Risks

| Risk | Mitigation |
| :--- | :--- |
| Argent MCP cannot start (PATH) | Phase 0.2 |
| Low RAM freezes the emulator | Phase 0.1, 4 GB AVD, close browsers while agents run |
| Test data written to a real database | Local Postgres and Redis plus a guard script (section 8.5). Remaining cloud side effects are listed there |
| Expo SDK 53 and Android API 37 incompatibility | Use an API 35 AVD |
| JDK 21 vs RN 0.79 Gradle | Verify in 0.8; JDK 17 fallback |
| Native modules missing from Expo Go | Dev build from Phase 0.8 |
| Face/voice need the Hugging Face Space AI engine, which may sleep or be slow | Allow warm-up time; tests tolerate cold starts |
| Web and mobile drift again | Shared operation list in `docs/mobile-parity.md`; parity check in each slice's done criteria |
| Large 935-line voice screen is hard to change safely | Characterize with Argent flows before refactoring |

---

## 6. Decisions needed from the developer

1. **Test data policy.** RESOLVED 2026-10-17: option A, a separate local development database (section 8.5). Agents never use the cloud database.
2. **Scope.** RESOLVED: core first, slices 1 to 6. (Was: full parity including playground and games, or core first (slices 1 to 6) with biometrics, security and playground later?)
3. **`android/` folder.** Commit generated native code (bare-style) or keep regenerating with `expo prebuild`?
4. **Android package id.** RESOLVED: `com.xemora.app`. (Was: confirm the intended id (current value is a template leftover) and whether any build has been published under it.)
5. **Stop unrelated Docker containers** during agent sessions (frees RAM and port 8081)?
6. **Commit `.claude/claude.md`** (the Argent agent rules) to the repo, or keep it local?
7. **Backend to test against.** RESOLVED: local backend on port 4001 against the local database (section 8.5).

---

## 7. Next actions

See "START HERE" at the top of this file. In short: (1) Step 0, the three account-hardening items, is built and waiting for the developer's decision before merging; (2) slice 2, chat replies; (3) slices 3 to 6; (4) Phase 4.

---

## 8. Phase 0 results (2026-10-17)

### 8.1 What was done
- 0.2: PATH files written (`~/.config/environment.d/10-dev-paths.conf`, plus a block in `~/.bashrc`; backup at `~/.bashrc.bak-before-android-env`). Takes effect after re-login. Argent MCP could not connect in the session where this was written.
- 0.5: `packages/ai-orchestrator` built; `backend` dependencies installed; Prisma client generated; backend runs on port 4001 (`/health` reports database healthy, Redis connected). The backend's own `npm run build` was deliberately not run because it executes `prisma migrate deploy` against the cloud database.
- 0.6: `mobile/App/libs/environment.ts` and `libs/config.ts` read `EXPO_PUBLIC_*` variables and default to `http://10.0.2.2:4001`. `.env.example` added.
- 0.7: Expo packages aligned to SDK 53 (`expo` 53.0.27, `react-native` 0.79.6, `expo-router` 5.1.11, `expo-constants`, `@react-native-community/slider` 4.5.6); added `expo-font`, `expo-linking`, `react-native-svg` (peer of `lucide-react-native`; native builds crash without it); removed invalid `ios.adaptiveIcon` from `app.json`; added `scheme: xemora`.
- 0.8: First dev build succeeded; app installs and shows the Sign In screen on `Xemora_Pixel_API_35`. `expo run:android` also rewrote the `android` and `ios` npm scripts to `expo run:android` and `expo run:ios`.

### 8.2 Dependency decisions made while fixing the build
| Change | Why |
| :--- | :--- |
| Removed `@react-native-voice/voice` and `@react-native-community/voice` | Never imported. The first pulls pre-AndroidX `appcompat-v7:28.0.0`, which broke manifest merging. Voice-input slice should choose a maintained library (for example `expo-speech-recognition`) |
| Removed `react-native-worklets` and `react-native-worklets-core` | Never imported. `react-native-worklets` is a Reanimated 4 package; with Reanimated 3.17 (Expo SDK 53) it defined the same classes as Reanimated and failed the dex merge |
| `nativewind` pinned to exactly `4.1.23` (was `latest`, which resolved to 4.2.1) | 4.2.x loads `react-native-worklets/plugin` unconditionally (Reanimated 4 only). 4.1.23 works with Reanimated 3 |

Do not upgrade `nativewind`, `react-native-reanimated` or add `react-native-worklets` independently of an Expo SDK upgrade.

### 8.3 Known issues left for Phase 2
- `tsc --noEmit` errors still present (baseline was 85; most in `services/api.ts`).
- Metro warnings: stray route file `app/features/voice/.tsx` has no default export; the root layout declares no route named `auth` (routes are `auth/sign-in`, `auth/sign-up`).
- `expo-doctor` still reports: old `@expo/config-plugins` is gone with the voice package; React Native Directory flags `expo-av` (deprecated in SDK 53, replace with `expo-audio`/`expo-video`), `clsx` and `react-native-gifted-chat` as unmaintained, and `@apollo/client`, `graphql`, `graphql-ws` as having no metadata (ignorable).
- Android package id is still the template value `com.danyrivas13.AppDeliveryReactNative` (decision 4 in section 6). Generated `android/` is gitignored and regenerated by prebuild (decision 3 resolved: do not commit).
- Edge-to-edge is not configured (`edgeToEdgeEnabled`); Android 16 / target SDK 36 will require it.

### 8.4 Quick start (after reboot or re-login)
```bash
# 0. Local database containers (start once; they restart with Docker)
docker start xemora-dev-postgres xemora-dev-redis

# 1. Backend (port 4001) against the LOCAL database. Always use the guard script.
cd backend && ./scripts/local-env.sh npm run dev

# 2. Emulator
emulator -avd Xemora_Pixel_API_35 -gpu host -no-audio &

# 3. Metro for the already-installed debug build (port 8082; 8081 is used by a Docker container)
cd mobile/App && npx expo start --dev-client --port 8082

# 4. Let the emulator reach Metro. Repeat after every emulator restart; without it the app shows a blank screen
adb -s emulator-5554 reverse tcp:8082 tcp:8082

# Rebuild the native app only after native dependency changes
cd mobile/App && npx expo run:android --port 8082
```
Use `--clear` on `expo start` after changing Babel or dependency configuration. A full native rebuild takes 4 to 5 minutes warm; the very first one took 40 minutes on this network.

The installed app is a plain `expo run:android` debug build: `expo-dev-client` is not a dependency, so there is no launcher screen and Metro is found only through the `adb reverse` above. The API needs no reverse because the app calls `http://10.0.2.2:4001` (the emulator's alias for the host).

### 8.6 Driving the app with Argent (verified 2026-10-17)
- Package id `com.danyrivas13.AppDeliveryReactNative`. Pass `port: 8082` to every Argent debugger tool.
- Login: type the email with `keyboard`, then the password with the placeholder `{{secret:XEMORA_TEST_PASSWORD}}`. The value comes from `ARGENT_SECRET_XEMORA_TEST_PASSWORD` in `~/.argent/secrets.env` (outside the repo, mode 600), which is a copy of `LOCAL_TEST_USER_PASSWORD`; update both if the password changes.
- `view-network-logs` only captures `fetch()`, and the app talks to the backend through Apollo, so it stays empty. To confirm API calls use `debugger-log-registry` (app console) and the backend log (`User ... logged in successfully`).
- Exit test passed: app launched, Sign In screen rendered, login as `agent-test@xemora.local` reached the local backend and opened Home.

### 8.5 Local development database (decision: option A)

Agents and manual testing use a local database. The cloud Supabase database and Upstash Redis in `backend/.env` are not touched.

| Piece | Detail |
| :--- | :--- |
| Postgres | Docker container `xemora-dev-postgres` (image `pgvector/pgvector:pg16`), `127.0.0.1:5433`, database `xemora_dev`, volume `xemora-dev-pgdata` |
| Redis | Docker container `xemora-dev-redis` (`redis:7-alpine`), `127.0.0.1:6380` |
| Settings | `backend/.env.local` (gitignored, mode 600): `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` and `LOCAL_TEST_USER_PASSWORD`. These override `.env` because `dotenv` never replaces variables that are already set |
| Guard | `backend/scripts/local-env.sh <command>` loads `.env.local` and refuses to run unless the database and Redis addresses are local. Use it for every backend, Prisma and seed command |
| Schema | Built with `prisma db push` (the migrations folder has no baseline, so `migrate deploy` cannot build a fresh database), after `CREATE EXTENSION vector`. Then the UP section of `20260418_vector_fts_indexes` was applied by hand (the file also contains a DOWN section; do not run it whole). 18 tables, two vector columns |
| Test account | `agent-test@xemora.local`; password in `LOCAL_TEST_USER_PASSWORD` (`backend/.env.local`). Created by `./scripts/local-env.sh npx ts-node scripts/seed-local-users.ts` |

Rebuild from scratch (container or volume lost):
```bash
docker run -d --name xemora-dev-postgres --restart unless-stopped -p 127.0.0.1:5433:5432 \
  -e POSTGRES_USER=xemora -e POSTGRES_PASSWORD=<same as in .env.local> -e POSTGRES_DB=xemora_dev \
  -v xemora-dev-pgdata:/var/lib/postgresql/data pgvector/pgvector:pg16
docker run -d --name xemora-dev-redis --restart unless-stopped -p 127.0.0.1:6380:6379 redis:7-alpine
docker exec xemora-dev-postgres psql -U xemora -d xemora_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
cd backend && ./scripts/local-env.sh npx prisma db push --skip-generate
sed '/^-- DOWN/,$d' prisma/migrations/20260418_vector_fts_indexes/migration.sql | \
  docker exec -i xemora-dev-postgres psql -U xemora -d xemora_dev -v ON_ERROR_STOP=1
./scripts/local-env.sh npx ts-node scripts/seed-local-users.ts
```

**Still cloud-backed (agents can cause real side effects here):**
- Supabase Storage and Cloudinary: avatar, face and voice uploads go to the real buckets and account.
- Gemini and Hugging Face API keys: calls use real quota. The Hugging Face Space AI engine (face and voice) is shared.
- Decision for later: create separate dev buckets or keys before the biometrics slice.

**Found along the way:** `backend/prisma/seed.ts` is stale (it writes a `title` field that `Document` no longer has) and fails to compile. It was not changed; fixing or retiring it is a separate decision.

### 8.7 Phase 2 progress (2026-10-24, branch `mobile-parity/phase-2-foundation`)

Done and committed (no device needed): session handling rebuilt for Apollo 4 (only an explicit UNAUTHENTICATED ends a session; expiry checked on launch, at expiry and on foreground; logout clears the cache; a stale rejection cannot sign out a newer session; outage at launch keeps the user signed in from the cached profile); `services/api.ts` typed and dead methods removed; template Items tab, three empty files and dead modules removed; type errors 85 to 0, ESLint errors 4 to 0 (9 warnings left in the voice screen and file-picker hook); Home shows real recent chats instead of invented statistics; Android package id is now `com.xemora.app`; Prettier applied in a separate commit.

Still to do (needs Argent and a native rebuild): edge-to-edge and status-bar overlap (F-19), Voice screen crash diagnosis (F-18), on-device check of Home, two-tab bar and chat screen, the two regression flows (launch, sign in, Home, sign out; expired session lands on Sign In), then the rebuild with the new package id (`npx expo prebuild --platform android --clean`, `npx expo run:android --port 8082`, reinstall).

Left for the owner: `new.txt`, `image and file.txt` and `voice/.txt` hold notes and were not deleted; `expo-sqlite` is unused (still in package.json and the app.json plugins); backend returns UNAUTHENTICATED for a wrong current password and for chats the user does not own, which the web client also treats as a rejected session (proposal: BAD_USER_INPUT and FORBIDDEN respectively); WebSocket subscriptions bypass the new error handling and keep the socket's old token after logout (no screen subscribes today).

### 8.8 Step 0 account hardening (2026-10-25, branch `mobile-parity/hardening-passwords`)

**D1 password length.** Followed the recommendation. `backend/src/auth/passwordPolicy.ts` (`MAX_PASSWORD_BYTES = 72`, `assertPasswordWithinByteLimit`, UTF-8 bytes via `Buffer.byteLength`) is called in `register` and `changePassword`; login is not capped. Mobile `libs/validation-schemas.ts` has `MAX_PASSWORD_BYTES`, `utf8ByteLength` (no TextEncoder) and `PASSWORD_HINT`; web has the same rule (TextEncoder) and its sign-up minimum is now 8, not 6. A test proves bcrypt ignores everything after byte 72, so the premise is checked. Tests: `backend/tests/passwordLength.test.ts`, `mobile/App/tests/validation.test.ts`, `web/tests/validation.test.ts` (script `test:validation`; web has no installed dependencies, so it was run through a scratch copy with the mobile toolchain, not through `npm run`).

**D2 screenshot blocking.** `expo-screen-capture ~7.2.0` (native dependency, added with `npx expo install`). `mobile/App/hooks/use-screen-capture-block.ts` applies it while a screen is focused (`useFocusEffect`, one key per screen) on sign-in, sign-up and change-password. Argent's screenshots and `describe` still work on these screens (emulator-side capture), so the protection is on in every build, not only release. Verified: `SECURE` in `dumpsys window` and a black `adb screencap` (about 16 KB) on all three screens, a normal capture on Profile and Home, flag released when leaving. Native rebuild used `./gradlew app:installDebug` (no `prebuild --clean`).

**D3 end other sessions.** Followed the recommendation. `SecurityConfig.passwordFingerprint` (HMAC-SHA256 of the stored hash keyed with `JWT_SECRET`, 16 hex characters) goes in the `pwf` claim of every token (`generateToken`; login, register, voice and face all use it); `authenticateToken` compares it with the stored hash (the production lookup `accountLookupFor` selects `password`, pinned by a test) and treats a missing or different claim as no session. `changePassword` returns a nullable `token`; mobile (`services/api.ts`) and web (`AuthContext.updateSessionToken`, plus a stale-rejection guard in the Apollo error link) store it. The password write is conditional on the verified hash (a concurrent change is refused with `BAD_USER_INPUT`). Strict mode: every existing token lacks `pwf`, so everyone signs in once after this ships; say so in the deployment notes. Verified live: a second token from curl got `UNAUTHENTICATED` after the device changed the password, the changing device stayed signed in and loaded Home; the test account was restored with the seed script.

**Verification.** Backend `test:authz` (10 suites), `test:tasks` and `tsc` clean; mobile `npm test` (11 + 16), `tsc`, ESLint (0 errors); `qa-auth-signin-home-signout` passed three times on the final native build (the emulator died once between runs and was restarted). Mutation checks: removing the fingerprint comparison, the off-by-one limit, counting characters instead of bytes, and returning the old-hash token each make a test fail. NOT verified: the web changes (no installed dependencies, so no `tsc`, lint or run; `AuthContext.tsx` type-checks in isolation apart from missing Vite types) and `qa-auth-session-expiry-signout` (needs the backend restarted with `JWT_EXPIRES_IN=60s`).

**Independent review (`reviewer-opus-medium`).** Verdict was fix before merge. Fixed: concurrent `changePassword` (conditional write), production lookup not pinned by a test, web token state and in-flight request handling after a change, mobile failure when only storing the new token fails, an overstated comment. Open for the developer: (1) live GraphQL subscriptions opened with an old token keep streaming after a password change (the session is checked only when the subscription starts); options are re-checking in the filter with a short cache, closing the user's sockets from `changePassword`, or accepting "next reconnect"; (2) password changes are not written to `securityAuditLog` (voice login is); (3) the one-time sign-out of everyone at rollout needs announcing.

**Incident.** On 2026-10-25 the plan file on disk was found reverted to an older version (the START HERE section was gone). The 293-line version already existed when `git stash` captured it at 00:11; the cause is unknown (another live session was open). START HERE was restored from the text read at the start of the session; the previous 401-line version was not recoverable from git because it had never been committed.

### 8.9 Slice 2: chat replies (2026-10-25, branch `mobile-parity/slice-2-chat-replies`, stacked on the Step 0 branch)

**What was built (followed the plan in section E, with additions).**
- `new.tsx` creates the chat with `messages: []` and a title of the first 40 characters (`libs/chat-start.ts`, `titleFromMessage`, 40 characters plus `...` when cut, as on web) and navigates with the first message as a route parameter. A synchronous ref stops a double tap from creating two chats.
- `app/features/chats/[id].tsx`: one `deliver()` sends typed messages, the first message and Retry. The first message is claimed once per chat at module level (`claimFirstMessage`), a thinking row shows while waiting, and a failure shows a plain message with Retry (`describeSendFailure`: connection, server answer, internal error, HTTP error, chat gone). History that arrives mid-send cannot erase the in-flight message.
- Backend: asking for a chat or message the caller does not own now answers `BAD_USER_INPUT` "Chat not found"/"Message not found" (was UNAUTHENTICATED, which signs clients out) in `sendMessageWithResponse`, `addMessage`, `updateChat`, `deleteChat`, `deleteMessage`; creating a chat for another user is `FORBIDDEN`.
- F-12: the chat list asks only for chat columns (the backend already selected only those; the client was requesting every message). Consequence: the list shows "Created <date>" instead of a preview, and search matches titles only (as on web). It says Created because sending a message does not change a chat's `updatedAt`.
- Found while testing and fixed (not in the plan): the chat list (60 s) and chat history (30 s) Redis caches were never invalidated, so a new chat was missing from the list and a just-used chat opened empty. `backend/src/services/chatCache.ts` drops the entries on every write, with a 500 ms bound because the Redis client waits forever when Redis is down.
- New accessible labels and ids: speaker avatars (`chat-avatar-user`, `chat-avatar-assistant`), the thinking row (`chat-thinking`), the New chat button (`chats-new`, label "New chat").

**Tests.** Backend `chatOwnershipErrors.test.ts`, `chatCacheInvalidation.test.ts` (both in `test:authz`); mobile `tests/chat-start.test.ts` (`npm test`, 13 tests); Argent flow `qa-chat-new-conversation-reply` (signs in, creates a chat with the prompt "Reply with the single word: ping", waits for the assistant avatar, checks the chat is listed, long-presses and deletes it, signs out). It passed twice in a row after fresh Argent services and again twice on the final code (one real Gemini call per run). Not covered by the flow: the thinking row (it shows for about two seconds, too short to wait for reliably), counting messages, a failed reply. Verified by hand on the emulator: one user message and one reply stored per send (checked through `chatHistory`), the failure banner with the network off ("No connection..."), Retry after restoring the network (message stored once), the thinking row after Retry.

**Review (`reviewer-opus-medium`, verdict fix before merge).** Fixed: `deleteMessage` masked its not-found code, double tap on Start Conversation, raw server text and a false "No connection" in failure messages, misleading "Updated" label. Open for the developer:
1. Retry is not idempotent: if a request reaches the server but the response is lost (or fails after the messages are saved), Retry saves and sends the message twice and spends quota. A safe fix needs a client-generated idempotency key stored with a unique constraint on the message, returning the existing pair on a repeat (a schema change); a weaker one refetches history before offering Retry.
2. When the AI provider fails or the quota check throws, the server saves "I am having trouble reaching the AI provider..." as a normal reply and returns success, so the app shows no failure and no Retry. This is the most common real failure. Options: keep it (honest text in the reply), mark such replies, or return an error.
3. Cache design: invalidating history uses a Redis SCAN (cost grows with the whole keyspace, twice per message); history is keyed by the reader, so an admin's view of someone else's chat is stale for up to 30 s; a read can repopulate a just-dropped entry. A per-chat version counter in the key fixes all three.
4. The first message travels in the route (`?firstMessage=`); on a web build a reload would send it again and the text sits in the URL. Matters only if the Expo web build ships.
5. If the first send fails and the user leaves, the empty titled chat stays and the message is lost (no draft).
6. The flow cannot detect a canned provider-failure reply or a double save (it never counts bubbles).

**Leftover test data (needs your decision).** The discarded first recording left one chat titled "Reply with the single word: pong" (plus a retry exchange from the manual failure test) in the local dev database for the test account. The flow uses "ping", so it never touches it. I did not delete it because you asked to be asked first (a deletion attempt through GraphQL was also blocked by the permission classifier).

**Decisions from the developer (2026-10-25).** Approved: the Step 0 recommendations (close subscriptions, audit-log entry, announce the one-time sign-out), the slice 2 recommendations, and moving on to slice 3 (tasks and push). The cache redesign (review finding 3 of slice 2) is deliberately NOT done: the current invalidation already gives the app what it needs (new chat appears at once, a used chat opens with its messages); the redesign would only fix an admin staleness window, a Redis scan whose cost grows with the keyspace, and a rare re-population race. Revisit if Redis grows large or admins start viewing user chats.

**Step 0 follow-up (done).** `backend/src/auth/socketRegistry.ts` remembers each signed-in user's WebSocket connections (registered in the graphql-ws context in `index.ts`) and `changePassword` closes them with code 4401 so clients reconnect with the fresh token; in memory, so it covers one server process only (several instances would need the close request shared, for example over Redis). Mobile reads its token at each connect and web has no subscriptions. Tests: `socketRegistry.test.ts` and extra cases in `changePassword.test.ts` (sockets of another user stay open, a refused change leaves them open, the audit record has no password or hash, an audit failure does not fail the change).

**Still waiting on the developer.** (a) Delete the leftover test chat "Reply with the single word: pong" (the permission classifier blocks the agent from deleting it, even after approval; in the app: Chats, long-press it, Delete). (b) Restart the backend with `JWT_EXPIRES_IN=60s` so the expiry flow can be re-run, then restart it normally.

### 8.10 Slice 3a: AI tasks list (2026-10-25, branch `mobile-parity/slice-3-recent-tasks`, merged locally)

Done (web parity with `RecentTasksPanel`, audit rows T1; T2 needs nothing yet because no mobile screen polls a single task):
- `app/features/tasks/index.tsx` (+ `_layout.tsx`): the user's 12 newest unarchived tasks (`myTasks`), each row with kind, plain status (Waiting, Working, Done, Did not finish, Canceled), age, and a progress bar while queued or working. Polls every 15 s only while the screen is focused and the app is in the foreground, refreshes on return, pull to refresh, loading, empty and error states (announced to screen readers). A failed task shows a fixed sentence, never the stored error text, and the query does not request `errorMessage`.
- Tapping a chat task opens its chat; other kinds open nothing until their screens exist. A task whose chat was deleted opens "This chat no longer exists." (composer hidden); a chat that fails to open offers Try again; server wording is never shown (`describeLoadFailure`).
- Home has an "AI tasks" row (`home-tasks`).
- Pure helpers `libs/tasks.ts` (labels, progress, metadata parsing, destination, spoken summary, age), tests `tests/tasks.test.ts`.
- Argent flow `qa-tasks-recent-list` (sign in, Home, AI tasks, rows show "Chat task, Done", back, sign out). Passed twice before and twice after the review fixes; the chat flow was re-run twice after the chat-screen changes and passed. Checked by hand: tapping a task of a deleted chat and of an existing chat.
- Independent review (`reviewer-opus-medium`): fixed missing retry and composer on a missing chat, accessibility gaps (announcements, progress read aloud, contrast), stale data on return and background polling, raw server wording on the chat load error. Left: the screens are light-only because `app.json` sets `userInterfaceStyle: light`.
- Flow data dependency (accepted, disclose): `qa-tasks-recent-list` needs a recent completed chat task among the account's 12 newest unarchived tasks. Tasks are archived after 30 days (`TASK_RETENTION_DAYS`) and any run of `qa-chat-new-conversation-reply` creates one, so run the chat flow first if the list is ever empty.

**Slice 3b (push) is blocked on a design decision (T3 and T4, `PR6` in the audit).** The backend supports Web Push only (`RegisterPushSubscriptionInput` needs `endpoint`, `p256dh`, `auth`; the service uses `web-push`). Options: (1) Expo Push: add `expo-notifications` on mobile, a new token-based subscription type on the backend, and a sender that calls Expo's push API (needs an Expo account and, for production, FCM credentials; a third party sees the notification text); (2) native FCM directly from the backend (Firebase project, service account secret; more setup, no Expo dependency); (3) defer push and rely on the in-app task list, as `docs/background-completion-phase-6` already treats push as best-effort and recovery as the task list. Recommendation: defer (3) for now and continue with slices 4 to 6, because the list already gives the recovery path and push needs credentials and a backend change that the developer should choose.

**Decision (2026-10-25): push is built last, with Expo Push, when the rest of the app is finished.** Slices 4 to 6 (and later 7 to 9 as scoped) come first. When push is picked up it needs: an Expo account, `expo-notifications`, a token-based subscription type on the backend (today Web Push only), a sender that calls Expo's push API, and push engagement tracking (T3, T4, PR6).

### 8.11 Slice 4: image generation (2026-10-25, branch `mobile-parity/slice-4-image-generation`, merged locally)

**Built.** `app/features/image/` (replaces the 12-line placeholder): prompt (500 characters) with counter, service status check, Create images (`generateAIImageVariants`, four images, one long request) with a progress card, 2x2 results, enlarge, Save to the photo library (`expo-media-library` write-only permission; the file is named by the image's real type; the temporary cache file is removed), fixed plain wording for failures (daily limit, rate limit, too long, anything else), and restore of a finished result when opened from AI tasks (`?taskId=`): polls the task until it is no longer running, stops when it is missing, failed or done. Opening the screen while an earlier generation is still running (found through `myTasks`, ignored if older than 3 minutes) shows that generation and blocks a second paid one. Only inline image data is shown or saved. Helpers in `libs/image-generation.ts` with 23 tests; `taskDestination` now opens image tasks on the image screen.

**Backend changes found necessary.** (1) Finished image tasks keep their base64 images in `Task.metadata` (megabytes). Both apps poll the task list every 15 s, so the list (`myTasks` and `User.tasks`) now drops `images` (`services/taskMetadata.ts`); the single-task query still returns them for restore. (2) `generateAIImageVariants` did not enforce the 500 character prompt limit (only `generateAIImage` did); it now refuses an empty or over-long prompt before creating a task or spending allowance.

**Verification.** `qa-image-restore-from-task` (sign in, AI tasks, open the finished image task, four images and prompt restored, enlarge and close, back, sign out) passed twice on the first build and twice after the review fixes. By hand: save to the library (appears in `DCIM`), the "task not found" state, normal opening not blocked. Needs `backend/scripts/seed-local-image-task.ts` (local-only, refuses non-local databases) so a finished image task is the newest.

**Not verified (blocked outside the app).** A live successful generation. The provider (Pollinations) answers 402 "Insufficient balance" (the account needs a top-up at enter.pollinations.ai); the app showed its fixed failure sentence. The success path was verified by restoring a seeded task instead. An unfinished flow file `mobile/App/.argent/flows/qa-image-generate-four-images.yaml` (untracked, its last step fails on purpose until credit exists) should be re-recorded and then committed when the provider has balance. Each live run spends 1 of the user's 10 daily images.

**Review (`reviewer-opus-medium`).** Fixed: endless spinner and polling for an unknown task id, second paid generation after leaving and returning, image lists via `User.tasks`, restore overwriting a newer generation, shared Apollo cache holding megabytes (restore query is now `no-cache`), https and other sources, seed script guard, missing server prompt limit, tests honouring task ownership. Left as notes: the saved file name contains up to 40 characters of the prompt (visible in the gallery); no path to Settings if the photo permission is permanently denied; the server still checks the daily allowance before and increments after, so two truly concurrent requests can both pass (an idempotency key or one-running-image-task-per-user rule would close it); `generateAIImageVariants` also returns raw error text (the mobile app never shows it, web does).

**Update (2026-10-25, later): live image generation verified.** After the developer topped up the Pollinations account, a real generation returned four images in 5 to 14 seconds. Flow `qa-image-generate-four-images` (sign in, Home, Image, prompt "A red fox in a snowy forest", Create images, four images, back, sign out) passed twice in a row; each run makes one real generation (1 of the 10 daily images, about 0.008 pollen). It does not wait for the progress card, which was seen while recording but lasts only seconds. Three generations were used in total (recording and two passes), about 0.024 pollen.

**Housekeeping done (2026-10-25).** The leftover test chat "Reply with the single word: pong" was deleted (after the developer's explicit go-ahead). The backend that was running was stopped by exact PID and replaced by one started from this session (`./scripts/local-env.sh npm run dev` as a background task, stoppable with `TaskStop`); Metro (port 8082) is still the other session's.



### 8.12 Slice 5a: voice text tools (2026-10-25, branch `mobile-parity/slice-5-voice`, merged locally)

**Decision (developer, 2026-10-25): voice goes through the backend's task-based processing** (`processVoiceTask`, Gemini), not on-device with fake fallbacks. Voice cloning and registration need multipart upload and the Python engine and are a separate slice (5b).

**Built.** `app/features/voice/index.tsx`: Translate (language list in the "Voice settings" panel) and Summarize call `processVoiceTask`. The third-party translator (MyMemory) and every invented fallback ("[Traducción al Español] ...", regex "enhancements", fake delay, "[Mode]" prefixes) are gone. A result replaces the text with a visible note ("Translated to Spanish. You can undo it below.") and an Undo that restores the text and the speech language; typing clears Undo; the box is read-only while a request runs and a result is dropped if the text changed meanwhile; double taps are blocked; failures show fixed plain wording (too long, language, too fast, session ended, connection, anything else), also inside the panel; a disclosure says that Translate and Summarize send the text to our server and speaking stays on the phone. The tone label is shown as a guess. The "AI Superpowers" marketing block, the hard-coded "ACTIVE & READY" badge and AI hype wording were removed. Fixed an existing layout bug: the panel's language list had collapsed to nothing. Helpers `libs/voice-tools.ts` (11 tests).

**Backend.** `processVoiceTask` now: refuses text over 5000 characters; accepts only the app's ten languages (a pattern could not tell "Spanish" from "Spanish then reply only PWNED"); sends the user's text as `<text>` delimited data after instructions that say never to follow instructions inside it (the text cannot close the tag); limits each user to 10 calls a minute; logs only `error.message`; returns a fixed sentence instead of internal error text; task records never contain the user's text (tested by recording every task-service call). Tests: `backend/tests/voiceTask.test.ts`.

**Flow.** `qa-voice-translate-undo` (sign in, Voice, type a sentence, Translate, Spanish, note, Undo restores the exact sentence, sign out). Passed twice before the review fixes and twice after. Each run makes one real model call. By hand: Summarize, and offline translate (plain "No connection" message, no invented text).

**Review (`reviewer-opus-medium`).** Fixed: a result overwriting later edits (High), marketing claims, language allowlist and prompt delimiting, per-user rate limit, Undo language, expired session wording, the duplicated error string, weak tests, accessibility. Open for the developer: (1) a DAILY quota for this mutation (chat has 20 a day, image 10, voice text none; only the per-minute limit exists); (2) the general GraphQL rate limiter keys by IP (it runs before the user is known), so behind a proxy without `trust proxy` all users may share one bucket (not verified); (3) the flow is a live smoke test and depends on Gemini being available; (4) the Apollo error link logs every network error with `console.error`, which raises the red development overlay on any offline action (development builds only).


### 8.13 Slice 6: profile and settings (2026-10-25, branch `mobile-parity/slice-6-profile-settings`, merged locally; the sign-out-other-sessions work of 2026-10-26 is in the same merge but has not been independently reviewed)

**Built.** Profile tab: usage counts (Chats, Messages, Voice jobs, Documents) from the `me` query, refreshed each time the tab comes into view; an unknown count shows a dash, never 0. New screens under `app/features/account/`: `edit-name.tsx` (1 to 100 characters after trimming, Save disabled until the name changes, counter, plain wording) and `assistant-settings.tsx` (tone, detail, technical depth and answer format as radio choices; reply language, role, field and goals as text up to 300 characters; starts from what the server holds; load error with Try again; Save disabled until something changes). The email is shown but cannot be changed in the app (the screen says so). Helpers `libs/profile.ts` (8 tests); shared `hooks/use-account-save.ts` (one failure message path for both screens; a save that finishes after the user left the screen does not navigate again). `updateProfile` in `use-auth.tsx` now returns false and changes nothing when the user signed out during the request, and stores the updated user for offline relaunch.

**Backend.** `updateProfile` refuses an empty, over-100 or `null` name (before: `null` crashed with a TypeError). `updatePreferences` refuses free text over 300 characters with `BAD_USER_INPUT` (before: silently cut) and returns the stored preferences (before: always `null` plus a logged `SyntaxError`, which also wrote `null` into the Apollo cache). Tests: `backend/tests/profileSettings.test.ts` (names, fixed choices, over-long text, returned preferences, session required for both mutations, each mutation writes only the caller's own record, `null` name). Mutation-checked: the over-long and returned-preferences tests fail on the old behaviour.

**Flow.** `qa-profile-name-and-settings` (sign in, rename to Agent Flow and back, set Formal and a role, save, reopen to see the role persisted, restore defaults, sign out). Two consecutive passes on the final code and YAML, fresh services, no warnings. Limits: the flow cannot read a radio's checked state, so the Formal/Casual choice itself is not asserted by the flow (only the role text persistence is); the Save tap on the first rename was added to the YAML by hand after an unrecorded tap (replays prove it); one early run showed a stray "0" appended to the typed name and a Save that did not navigate; it did not repeat in four later runs and the cause is unknown.

**Review (`reviewer-opus-medium`, verdict BLOCK before fixes).** Fixed: silent truncation (Medium), `preferences: null` from the mutation (Medium), signed-out user restored by a late save (Medium), double navigation after leaving during save, zero shown for unknown counts and stale counts, test gaps (own-record check, no-session test, mislabelled "unknown keys" test), `null` name crash, accessibility (error announced only when present, radio groups, counters), two different failure paths. Decided by the developer (2026-10-25: "choose the best recommended way") and built afterwards, see below. Still open: (c) free-text preferences flow into the chat system prompt (existing behaviour, not reviewed here).

**Account change hardening (same day, backend only).** Email: `updateProfile` takes an optional `currentPassword` and requires it when the address actually changes (wrong or missing: `BAD_USER_INPUT`, checked before the "already taken" answer so addresses cannot be probed; same address, including a stored one with capitals, is not a change; a unique-index race answers "already taken"). Preferences: `updatePreferences` now merges into the stored record with a conditional write (two devices saving at once keep both changes; up to 3 attempts), re-checks what is already stored (invalid old entries are dropped), and writes nothing when nothing changed. Audit: `PROFILE_UPDATED`, `EMAIL_CHANGED`, `PREFERENCES_UPDATED` through the shared `src/auth/accountAudit.ts` (also used by `PASSWORD_CHANGED`); details list changed field names only, never values; unchanged resaves write no record; an audit failure is logged and never fails the saved change. Tests: `backend/tests/accountChanges.test.ts` (15 cases, each fix mutation-checked). Reviewed by `reviewer-opus-medium` (FIX-BEFORE-MERGE, all actionable findings fixed). Live: the profile flow passed against the real database after the change, and the audit rows were read back (field names only). **Consequence for web:** its Settings page has an editable email but no password field, so changing the email there now fails with "Enter your current password to change your email" until it sends `currentPassword` (name-only saves are unaffected; web is not built or tested here). Also noted, not changed: the `updateProfile` declaration exists in both `src/schema/schema.ts` and `src/schema/auth.ts` and must be edited in both.

**Password guessing limit and web field (same day, developer-approved).** `src/auth/passwordAttempts.ts` + `currentPassword.ts`: both `updateProfile` (email change) and `changePassword` now share one limit of 5 current-password attempts per user per 15 minutes. The attempt is reserved BEFORE bcrypt runs (the first version counted after, so 30 parallel guesses all got through; the review proved it), a correct answer clears the count, the attempt that reaches the limit starts a full 15-minute lock, and while locked even the right password is refused (`BAD_USER_INPUT`, "Too many incorrect passwords"). An empty password is not a guess and is not counted (in both mutations). Audit: `PASSWORD_CHECK_FAILED` per wrong answer and `PASSWORD_CHECK_LOCKED` once, details `{action}` only. Accounts with no password hash change their email without one (developer decision; none are known to exist); `changePassword` still refuses them. In memory like the voice limiter: resets on restart, per server process. Web: Settings shows a Current Password field only while the email differs from the account's email, sends it as `currentPassword`, clears it when the email is reverted or a save fails, and the three fields are now labelled (`htmlFor`); web is not built or run here (syntax-checked only). Tests: `passwordAttempts.test.ts` (burst of 30 parallel guesses, empty password in both mutations, full-window lock, unlock on success; mutation-checked). Reviewed (BLOCK before fixes; all fixed except the decisions below). **Open for the developer:** (1) ~~`login` has no per-account guess limit~~ FIXED, see "Sign-in limit and sign out other sessions" below; (2) the lock is keyed by user, so a thief with a stolen session can keep the real user locked out of changing the password (the sign out other sessions button below now ends a stolen session, but there is still no reset-by-email route to recover); (3) the counter is per process, so a Redis-backed counter is the follow-up if the backend runs on several instances.

**Sign-in limit and sign out other sessions (2026-10-26, commits `f17b6f4` backend, `f49d7ab` mobile).** Backend: GraphQL `login` allows 5 attempts per email in 15 minutes, counted before the password is compared and answered identically for unknown emails (so addresses cannot be probed); wrong attempts, lockouts and ended sessions are audited. New `users.sessionVersion` column (migration `20261026_session_version`, additive, default 0) is carried in tokens; `signOutOtherSessions` bumps it, ends every session but the caller's without asking for a password, and returns a fresh token for the caller. Tests: `loginAttempts.test.ts`, `sessionVersion.test.ts`, plus additions to `passwordAttempts.test.ts` and `sessionUser.test.ts`. Mobile: Profile has a "Sign out other devices" button that stores the fresh token; flow `qa-profile-sign-out-other-devices` (sign in, tap the button, see the confirmation, open Assistant settings to prove the new token loads data, sign out). Checked on 2026-10-31: `tsc --noEmit` clean and the four test files above pass. On 2026-10-31 the flow `qa-profile-sign-out-other-devices` passed twice in a row on the emulator against the local backend (27 steps each, the `sessionVersion` column exists in the local database, which was built with `db push`). NOT checked: the migration against a database other than local. An independent review by `reviewer-opus-medium` on 2026-10-31 returned BLOCK; see "Review fixes (2026-10-31)" below.

**Review fixes (2026-10-31, uncommitted when written).** Findings and what was done, with the developer's decisions of the same day:
- *Mobile token write-back (High).* A late response could store a fresh token after the user had signed out, so the app signed them in again on the next launch. `libs/token-swap.ts` (`replaceTokenIfSessionUnchanged`, 5 tests) stores the token only if the device still holds the token the request started with; used by `signOutOtherSessions` and `changePassword`. Sign Out is disabled while the request runs. `storageService.replaceAuthToken` throws on a failed write (the old `setAuthToken` swallowed errors, so a storage failure had been reported as success); the Profile screen now says "Please sign in again on this device" in that case. Known gap: the check and the write are two storage calls, so a sign-out landing between them (milliseconds) is not covered.
- *Lockouts evicted by a flood (Medium).* `passwordAttempts.ts`: one table per key namespace (`login`, `loginEmail`, `password`, `face`), a locked window is never evicted while any other window exists (then expired, then oldest still counting; if only locks remain, the one that ends first). New tests lock first and flood second. Mutation-checked.
- *Anyone can lock a user out of sign-in (Medium), developer decision: per email AND address plus a looser per-email ceiling.* `signInAttempts.ts`: 5 per (email, address) and 20 per email across addresses (`MAX_ATTEMPTS_PER_EMAIL`), both reserved before bcrypt; success clears the pair and refunds the ceiling. Emails over 254 characters are refused before they reach the table. The 20 is a judgement call and can be tuned. **Important:** the backend does not set `trust proxy`, so behind a proxy `req.ip` is the proxy's address and every user shares one "address"; the per-address limit then degrades to the old per-email limit (safe, but the benefit only arrives once `trust proxy` is set to the real number of proxy hops). (Correction, third review: the general GraphQL rate limiter does not count all users together, it counts nobody; see the third review paragraph below.) Not changed; needs the developer to confirm the deployment's proxy chain.
- *Unknown emails invisible (developer decision: audit and count).* A wrong sign-in for an email with no account now writes `PASSWORD_CHECK_FAILED` with no user, no email and `{action, knownAccount:false}`, plus the address and user agent; the typed email and password are never stored. Failures and refusals are counted through Sentry metrics (`auth.sign_in.failed` with reason `unknown_email`, `wrong_password` or `disabled`; `auth.sign_in.locked` with scope `address` or `email`) via `utils/securityMetrics.ts`; counts reach Sentry only when `SENTRY_DSN` is set, and Sentry has to have metrics enabled for the project.
- *Disabled account audited as guessing (Low).* Now `LOGIN_REFUSED_DISABLED`.
- *Face login had no limit (developer decision: fix).* `faceLoginAttempts.ts`: 10 per address per 15 minutes, reserved before any photo is compared, an offline service refunds the attempt, success clears, failures counted (`auth.face_login.failed`, `auth.face_login.locked`), a lockout audited (`FACE_LOGIN_LOCKED`). Same `trust proxy` caveat: until it is set, 10 failed face attempts from anyone lock face sign-in for everyone for 15 minutes (the message tells them to use their password).
- *Socket close code (Low).* 4401 is fatal for graphql-ws clients, so the signed-in device could never resubscribe; now 4499, which they retry with the current token.
- *Migration (Low).* `SET lock_timeout = '5s'` added to `20261026_session_version`. This edits a migration file that exists only locally; if it was ever applied somewhere, Prisma will see a changed checksum.
- *Not changed.* Counters are still per process (developer to say whether several instances run; see below). A login that races a sign-out can return an already-stale token (fails closed).
Checks: backend `tsc` clean, `test:authz` and `test:tasks` pass (new: `faceLoginLimit.test.ts`; extended: `loginAttempts`, `passwordAttempts`), mobile `tsc`, eslint, prettier and `npm test` (8 files) pass, flows `qa-profile-sign-out-other-devices` (twice) and `qa-auth-signin-home-signout` pass on the emulator. A second independent review (`reviewer-opus-medium`, 2026-10-31) returned BLOCK, mainly for one bug introduced by the first round of fixes: a successful face login cleared the whole address's count, so anyone with an enrolled face of their own could alternate genuine logins with guesses at other people's faces and never reach the limit (probe: 450 guesses, 0 refused). Fixed the same day: a success now gives back only its own attempt (`faceLoginAttempts.ts`); the face lockout is audited only when the attempt that used up the limit actually fails (an offline service or a genuine login is not a lockout); eviction now removes the window with the least progress first, so a junk flood cannot reset a target's partial ceiling count (the earlier comment claiming an attacker could only reset their own count was wrong); `reserveAttempt` decides with the limit stored in the window, the same value eviction uses; the migration ends with `RESET lock_timeout`. New tests for each, mutation-checked (success clears all, no pair refund, evict oldest: each makes a test fail). Final checks: backend `tsc`, `test:authz`, `test:tasks`, mobile `npm test` pass; `qa-profile-sign-out-other-devices` passed twice more on a restarted backend. **Open for the developer, not changed:** (a) the per-email ceiling of 20 lets a stranger with 4 or more addresses (one IPv6 /64 gives that for free) lock the owner out of password sign-in for 15 minutes, renewable with 20 requests; options are grouping IPv6 by /64 for the pair key and the face key, letting a correct password from an address with no failures skip the ceiling (needs bcrypt before the ceiling), or accepting it and alerting on `auth.sign_in.locked` with scope `email`; (b) `login` and `loginWithFace` sent over the WebSocket have no `req`, so they all share the "unknown" address bucket (one extra bucket for an attacker; audit rows have no IP); the fix is to build the address from `ctx.extra.request` in the WebSocket context in `index.ts` or to refuse these mutations without an address; (c) every wrong sign-in for an unknown email writes one `security_audit_logs` row, so credential stuffing can write rows without limit; decide retention or sampling (the metric already shows volume); (d) the other face endpoints (`compareFaces`, `findFaceInCrowd`, `verifyFaceInWorkspace`) are not limited; (e) `trust proxy` (see above).

**Decisions applied (2026-10-31, developer: "use the recommended settings").** (a) Done: `auth/networkAddress.ts` (`networkOf`) counts an IPv6 /64 as one client and an IPv4-mapped IPv6 address as its IPv4 form; used by the sign-in pair key and the face key. Tests: `networkAddress.test.ts`, plus a four-address /64 case in `loginAttempts` and `faceLoginLimit` (mutation-checked). The ceiling of 20 per email can still lock an owner out for 15 minutes if an attacker uses 4 or more separate networks; that residual risk is accepted and visible through `auth.sign_in.locked` with scope `email`. (b) Done: `createContext` builds `req.ip` and headers from the WebSocket request (`connection.extra.request`), so WebSocket `login` and `loginWithFace` use the real socket address and audit rows carry it (`connectionContext.test.ts`). Behind a trusted proxy this would need the forwarded address. (c) Done: each network writes at most 20 unknown-email audit rows per window (`MAX_UNKNOWN_EMAIL_AUDIT_ROWS`); the metric still counts every failure. A retention period for `security_audit_logs` is still to be decided against the legal requirement. (d) Deferred by decision to a separate change: `compareFaces`, `findFaceInCrowd` and `verifyFaceInWorkspace` stay unlimited (they need a login). (e) Still open: `trust proxy` needs the real number of proxy hops of the deployment, and the instance count (Render, Settings, Scaling) decides whether the counters must move to Redis. Final checks on this code: backend `tsc`, `test:authz`, `test:tasks`, mobile `npm test` pass; `qa-profile-sign-out-other-devices` passed twice in a row and `qa-auth-signin-home-signout` once on the emulator. The emulator crashed twice with a host-GPU segfault (exit 139) during the run; it was restarted with `-gpu swiftshader_indirect` (software rendering, slower: a "System UI isn't responding" dialog may appear after boot, tap Wait). A flow that dies mid-run leaves the app signed in, so sign out by hand before rerunning. Counter is still per process (item 3 above applies to the login limit too). Web has no "sign out other devices" control yet.

**Third independent review and fixes (2026-10-31).** `reviewer-opus-medium` on `15ece71`, `0946adc` and `88b3cec` returned FIX-BEFORE-MERGE. Fixed (tests first, mutation-checked where noted):
- *The planned way to read the proxy count did not work.* In production the application logger keeps only errors, in files that are lost on Render, and the console is silenced, so the forwarding fields added to the request log would never appear. Replaced by `middleware/forwardingDiagnostic.ts`: switched on with the environment variable `FORWARDING_DIAGNOSTIC=true`, it writes at most 20 JSON lines straight to the process output (shown in Render's Logs page), each with the address Express chose, the raw peer address and the shortened `X-Forwarded-For` and `CF-Connecting-IP` headers. It is off by default and meant to be switched off again after one look. The log fields were removed from the normal request log.
- *WebSocket address ignored the proxy count.* `auth/clientAddress.ts` works out the address of a WebSocket upgrade through Express's own `req.ip` logic, so HTTP and WebSocket always agree (`clientAddress.test.ts`).
- *A face engine that was up but could not answer counted as a guess.* A timeout or a failed connection to the engine now hands the attempt back, tells the user the service is temporarily unavailable (not that their face was wrong), counts `auth.face_login.unavailable`, and writes no lockout (mutation-checked).
- *`networkOf` edge cases.* Ports, brackets, zone ids and every spelling of an IPv4-mapped address (hex and dotted) are handled; anything unreadable or longer than 64 characters shares the one `unknown` key and is never echoed into a key.
- *`TRUST_PROXY_HOPS` is stricter.* Leading zeros, signs, exponents and non-ASCII digits are refused (`01`, `00`, `+2`, `1e1`).
- *Mobile Change Password* discarded the token-swap result: a failed keychain write still showed plain success. Both screens now use `mustSignInAgain` and say "Please sign in again on this device" (6 token-swap tests).
Checks: backend `tsc`, `test:authz`, `test:tasks` and mobile `tsc`, eslint, `npm test` pass; prettier is clean on every file changed (the 11 files `prettier -c .` still flags are flow YAML, `global.css` and `cesconfig.jsonc`, all untouched); `qa-profile-sign-out-other-devices` passed twice in a row; `qa-auth-signin-home-signout` passed twice in a row. It failed twice earlier in the same run with "Network error: Unable to connect to server" while the backend had logged the sign-in as successful and the machine's load average was 16 (software-rendered emulator, Docker VM and a C# compiler from another project); it passed twice once the load dropped.
**Open for the developer, not changed:**
- *(FIXED 2026-10-31, see below)* *The general `/graphql` rate limiter never limits anything (pre-existing, Medium).* `backend/src/auth/rate-limiting.ts` calls `ipKeyGenerator(req)`, but express-rate-limit 8 expects an address string, so every request gets its own bucket (the 100 per minute cap never applies) and the limiter keeps each request object in memory for up to two minutes. The review reproduced 6 of 6 requests allowed with a cap of 3. The one-line fix is `ipKeyGenerator(req.ip ?? '')`, but do NOT apply it before `TRUST_PROXY_HOPS` is set and verified on Render: until then every user shares the proxy's address, so the cap of 100 per minute would apply to the whole app together and could throttle all users. Fix both in the same deploy.
- Until `TRUST_PROXY_HOPS` is set, face sign-in is one shared bucket of 10 per 15 minutes that any stranger can use up (password sign-in is unaffected); accepted for that period.
- A refund is not tied to the window that took the reservation, so at a window boundary an in-flight request can refund into the next window, and an audit row can say "locked" for a limit that a later success handed back (low, bounded by concurrency).
- `TRUST_PROXY_HOPS` is applied in `index.ts`; no test fails if that line is deleted (the parser and the Express behaviour are tested, not the wiring).
- If callers can reach the `*.onrender.com` origin directly (not through Cloudflare) and the hop count is set for the Cloudflare path, a direct caller's forged leftmost address would be believed. Check whether the origin is reachable directly before choosing the number.

**Proxy count and rate limiter (2026-10-31).** Render's diagnostic lines (with `FORWARDING_DIAGNOSTIC=true` on the live service) showed the app's direct peer is a local proxy (`::1`) and `X-Forwarded-For` holds three entries: the real client, a Cloudflare edge address (172.x) and a Render-internal address (10.x); `CF-Connecting-IP` matched the first. Express counts from its own peer outward, so **`TRUST_PROXY_HOPS=3`** reaches the real client (two would report Cloudflare for everyone, four would believe a caller-written entry). Requests with no forwarding header come from `10.216.x.x` addresses (Render's own checks). A test (`trustProxy.test.ts`) pins this chain, including that an address a caller puts at the front of the header is ignored. The rate limiter now keys on `req.ip` (`rateLimiter.test.ts`: the 101st request in a minute is refused, another client is not; mutation-checked), and a production server without the variable prints a warning at startup. Deploy order that avoids throttling everyone: set `TRUST_PROXY_HOPS=3` in Render first, confirm in the diagnostic that `expressIp` is the visitor's address, then ship the limiter fix. Not covered: if a path around Cloudflare existed, a caller on it would have a shorter chain; none was found.
