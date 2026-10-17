# Mobile App: Web Parity Implementation Plan (Agent-Driven with Argent)

Goal: bring the Xemora mobile app (`mobile/App`, Expo) to the same feature level as the web app (`web/`), with AI agents building and testing it on a device through Argent, so the developer does not paste logs, errors or screenshots by hand.

Status: Phase 0 mostly complete (2026-10-17). Remaining: 0.1 (optional), 0.2 re-login, 0.9 Argent exit test. See section 8 for the Phase 0 results and the quick-start commands. Changes are on branch `mobile-parity/phase-0-setup`, uncommitted.

Related: `README.md` (product overview), `new and current voice identity auth implementation_plan.md` (voice login, already live on web), `docs/background-completion-phase-*.md` (tasks and push design).

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

0.9 PENDING (needs re-login and a new Claude Code session). Run the `argent-environment-inspector` agent once; save its JSON result to project memory; confirm exit test.

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
| Test data written to a real database | Decide the test-data policy before Phase 3 (section 6) |
| Expo SDK 53 and Android API 37 incompatibility | Use an API 35 AVD |
| JDK 21 vs RN 0.79 Gradle | Verify in 0.8; JDK 17 fallback |
| Native modules missing from Expo Go | Dev build from Phase 0.8 |
| Face/voice need the Hugging Face Space AI engine, which may sleep or be slow | Allow warm-up time; tests tolerate cold starts |
| Web and mobile drift again | Shared operation list in `docs/mobile-parity.md`; parity check in each slice's done criteria |
| Large 935-line voice screen is hard to change safely | Characterize with Argent flows before refactoring |

---

## 6. Decisions needed from the developer

1. **Test data policy.** Is `backend/.env`'s Supabase database safe for agent test accounts, or should there be a separate dev project/branch? Is a throwaway test user acceptable? (Blocks Phase 3.)
2. **Scope.** Full parity including playground and games, or core first (slices 1 to 6) with biometrics, security and playground later?
3. **`android/` folder.** Commit generated native code (bare-style) or keep regenerating with `expo prebuild`?
4. **Android package id.** Confirm the intended id (current value is a template leftover) and whether any build has been published under it.
5. **Stop unrelated Docker containers** during agent sessions (frees RAM and port 8081)?
6. **Commit `.claude/claude.md`** (the Argent agent rules) to the repo, or keep it local?
7. **Backend to test against.** Local backend on port 4001 (preferred for debugging) or the deployed Render instance?

---

## 7. Next actions

1. Developer: answer section 6 (at least 1, 2 and 7).
2. Developer (or approved agent): Phase 0.1 to 0.4.
3. Agent: Phase 0.5 to 0.9, then Phase 1 audit for review.

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
# 1. Backend (port 4001)
cd backend && npm run dev

# 2. Emulator
emulator -avd Xemora_Pixel_API_35 -gpu host -no-audio &

# 3. Metro for the already-installed dev build (port 8082; 8081 is used by a Docker container)
cd mobile/App && npx expo start --dev-client --port 8082

# Rebuild the native app only after native dependency changes
cd mobile/App && npx expo run:android --port 8082
```
Use `--clear` on `expo start` after changing Babel or dependency configuration. A full native rebuild takes 4 to 5 minutes warm; the very first one took 40 minutes on this network.
