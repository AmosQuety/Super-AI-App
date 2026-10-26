# Mobile / Web Parity Audit (Phase 1, code side) - DRAFT

Date: 2026-10-17. Method: read-only code review (no code run except `tsc --noEmit` and a throwaway GraphQL validation script that parses the backend SDL and validates every web and mobile operation; nothing was started, installed or modified).
Paths below are relative to the repo root `Super-AI-App/`. Web = `web/src`, mobile = `mobile/App`, backend schema = `backend/src/schema/schema.ts` (+ `schema/auth.ts`), resolvers = `backend/src/resolvers`.

Reading order: (1) this overview, (2) parity table, (3) findings, (4) operation matrix, (5) screen inventory, (6) slice-order proposals, (7) open questions, (8) limitations.
Column "Observed on device" was filled in from an emulator walkthrough on 2026-10-17 (Android 15, local backend, test user). Entries marked "n/a" have no mobile screen.

## 1. Overview and headline numbers

| Item | Value | Evidence |
| :-- | :-- | :-- |
| Web features inventoried | 40 (8 areas) | section 2 |
| Mobile status | done 4, partial 9, missing 27 | section 2 |
| Web GraphQL operations | 47 unique operation names: 43 under `web/src/graphql/*.ts` (44 definitions, `RegisterVoice` is defined twice with different variable names) + 4 inline in components (`GetWorkspaces`, `GetWorkspaceFaces`, `VerifyInWorkspace`, `CreateWorkspace`). Web also sends `Login`/`Register` as raw `fetch` in `web/src/contexts/AuthContext.tsx:85,143` | section 4 |
| Web operations defined but never used by a component | 6: `DeleteMessage`, `GenerateGeminiContent`, `GetFaceServiceStatus`, `GetImages`, `GenerateImage`, `GenerateAIImage` (+ the `REGISTER`/`LOGIN` constants, because AuthContext inlines them) | grep of `web/src` |
| Mobile GraphQL operations | 11 in `mobile/App/services/graphql/operations.ts` + 5 inline in chat screens (`app/features/chats/index.tsx:23,38`, `new.tsx:20`, `[id].tsx:26,44`); 12 distinct root fields (11 plus `deleteChat`) | section 4 |
| Backend schema validation of web ops | 43 of 44 definitions under `web/src/graphql` valid; `GetTask` invalid (see F-06). The 4 inline web ops were checked by eye against the SDL, not scripted | validation script, graphql-js against SDL |
| Backend schema validation of mobile ops | 11 of 11 in `operations.ts` valid; inline ops are subsets of validated ones (not separately validated) | same |
| `tsc --noEmit` (mobile) | 85 errors in 16 files | section 3 |

The plan's section 1.4/2 numbers (11 mobile ops, 43 web ops, 85 tsc errors) are confirmed. Two plan assumptions are refuted or refined: "Delete message" is not a parity gap (the web defines `DeleteMessage` but never calls it), and mobile "Face login" is declared at API level only (see F-09 / section 7).

## 2. Parity table by feature

Status: done / partial / missing. Effort: S (under 1 day) / M (1-3 days) / L (more than 3 days). Risk: Standard / Review / Independent review (plan Phase 3 table).

| ID | Web feature (source of truth) | Mobile status (evidence) | GraphQL ops | Native / Expo approach | Effort | Risk | Observed on device |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **Auth** | | | | | | | |
| A1 | Email sign-in (`web/src/components/auth/Login.tsx`, `contexts/AuthContext.tsx`) | done: `app/auth/sign-in.tsx` -> `hooks/use-auth.tsx` -> `services/api.ts:130` stores token | Login | expo-secure-store (already used) | S | Independent review | Works: login as agent-test reached the local backend and opened Home |
| A2 | Register (`auth/Register.tsx`) | done for email/password: `app/auth/sign-up.tsx`; web also offers face enrolment at sign-up, mobile does not | Register, RegisterUserFace | expo-camera for face part | S (+M face) | Independent review | Screen renders (name, email, password, 6-character hint); not submitted |
| A3 | Face login (`auth/FaceCapture.tsx`, `Login.tsx` face mode) | partial: operation + `apiService.loginWithFace` exist (`services/api.ts:362`, `operations.ts` LOGIN_WITH_FACE) but no capture UI is wired into `sign-in.tsx` (section 7 check c), and no upload link (F-02) | LoginWithFace | expo-camera, multipart upload link | M | Independent review (biometrics) | Confirmed: Sign In shows no face option |
| A4 | Voice login challenge-response (`auth/VoiceLogin.tsx`, `VoiceCapture.tsx`, `services/voice/VoiceBiometricsService.ts`) | missing | GetVoiceLoginChallenge, LoginWithVoice | expo-audio recording, multipart upload | M | Independent review (biometrics) | n/a (not on mobile) |
| A5 | Change password (`pages/SettingsPage.tsx`) | missing UI; `useAuth.changePassword` exists but its operation is not exported (F-03) | ChangePassword | none | S | Independent review (auth) | n/a (not on mobile) |
| A6 | Logout (`AuthContext.signOut` clears token, user and Apollo store) | partial: `services/api.ts:382` clears token/user only, Apollo cache not cleared (F-05) | - | - | S | Independent review (auth) | Sign Out works and returns to Sign In |
| A7 | Session restore / expiry (`AuthContext` + `lib/apolloClient.ts` ErrorLink) | partial: `hooks/use-auth.tsx` `checkAuthStatus` trusts token presence then calls `me`; no working 401 handling (F-01) | GetMe | - | S | Independent review (auth) | Not walked |
| **Chat** | | | | | | | |
| C1 | Chat list (`chat/Sidebar.tsx`, `ChatContainer.tsx`) | done: `app/features/chats/index.tsx` (search, delete, refresh). Fetches all messages of every chat (F-12) | GetChats, DeleteChat (mobile only) | - | S | Standard | Works: list loads, empty state for a new user; header sits under the status bar |
| C2 | Create chat (`ChatContainer.tsx`) | done: `app/features/chats/new.tsx` | CreateChat | - | S | Standard | Works: chat and first user message created and stored (DB row confirmed) |
| C3 | Chat history, pagination (`ChatContainer.tsx`) | partial: `[id].tsx:~145` loads first 50, `hasMore` read; load-more not verified | GetChatHistory | - | S | Standard | Not walked |
| C4 | Send message + AI reply (`ChatContainer.tsx`, `InputArea.tsx`, `Message.tsx`) | partial: calls `sendMessageWithResponse` (`[id].tsx:~281`); omits `activeDocumentIds`; no task/status handling; see section 7 check a | SendMessageWithResponse | - | M | Review | Not exercised from the detail screen; see C2 and F-17 |
| C5 | Attachments in chat (web: Cloudinary direct upload `web/src/services/cloudinary.ts`) | partial: `services/cloudinary-service.ts` unsigned upload from the device, needs `EXPO_PUBLIC_CLOUDINARY_*` which are absent from `.env.example` (F-11) | (sent as `fileUri` etc. in SendMessage) | expo-image-picker, expo-document-picker (`hooks/use-file-picker.ts`, `components/file-picker.tsx`) | M | Review (user files) | Not walked |
| C6 | Document upload for RAG (`chat/DocumentUploader.tsx`) | missing | UploadDocument | expo-document-picker + multipart upload (F-02) | M | Review (user files) | n/a (not on mobile) |
| C7 | Document lifecycle status (`DocumentUploader.tsx`, `ChatContainer.tsx`) | missing | GetDocumentLifecycle | polling | S | Review | n/a (not on mobile) |
| C8 | Context panel / active documents (`chat/ContextPanel.tsx`) | missing | (via SendMessageWithResponse.activeDocumentIds) | - | M | Review | n/a (not on mobile) |
| **Tasks and push** | | | | | | | |
| T1 | Recent AI Tasks panel (`tasks/RecentTasksPanel.tsx`) | missing | GetMyTasks | polling 15 s | M | Review (personal data) | n/a (not on mobile) |
| T2 | Task polling used by image, voice, playground (`GET_TASK` in 5 components) | missing; web query is invalid against schema (F-06) | GetTask | - | S | Standard | n/a (not on mobile) |
| T3 | Push subscribe / unsubscribe / settings (`settings/PushNotificationSettings.tsx`, `public/sw.js`) | missing. Backend is Web Push only: `RegisterPushSubscriptionInput` requires `endpoint`, `p256dh`, `auth` (`schema.ts:325`), service uses `web-push` (`services/pushNotificationService.ts`). Expo/FCM tokens do not fit: needs a backend decision | GetPushNotificationConfig, GetMyPushSubscriptions, RegisterPushSubscription, UnregisterPushSubscription | expo-notifications (+ dev build) | L | Independent review (push, personal data) | n/a (not on mobile) |
| T4 | Push engagement tracking (`Layout.tsx`) | missing | TrackPushEngagement | notification response listener | S | Review | n/a (not on mobile) |
| **Image** | | | | | | | |
| I1 | AI image generation, 4 variants, task restore (`components/ImageGenerator.tsx`) | missing: `app/features/image.tsx` is a 12-line placeholder ("Image Tab") | GenerateAIImageVariants, GetTask | expo-file-system / expo-media-library for save; base64 images | M | Standard | Confirmed: bare "Image Tab" text, no header or back control |
| I2 | Image service status (`ImageGenerator.tsx`) | missing | GetAIImageStatus | - | S | Standard | n/a (not on mobile) |
| **Voice** | | | | | | | |
| V1 | Voice Tools: text to speech (`VoiceTools.tsx`, `services/voice/tts.worker.ts`) | partial: on-device `expo-speech` only (`app/features/voice/index.tsx:350`) | - | expo-speech (kept) | S | Standard | Opens; "Load Sample Text" crashes the screen (F-18), reproduced twice |
| V2 | Translate via backend (`VoiceTools.tsx`) | partial: mobile calls a public third-party API directly (`voice/index.tsx:82`), not the backend; silent fake fallback (F-08) | ProcessVoiceTask | - | S | Review (user text leaves system) | Not walked |
| V3 | Summarize (`VoiceTools.tsx`) | missing: mobile "AI enhance" is regex replacement with a fake 1 s delay (`voice/index.tsx:~283-310`) | ProcessVoiceTask | - | S | Standard | n/a (not on mobile) |
| V4 | Voice clone (`VoiceLab.tsx`) | missing: "voice clones" are 6 rate/pitch presets (`voice/index.tsx:46-53,217`) | RegisterVoice, CloneVoice | expo-audio record, multipart upload | L | Independent review (biometric-like audio, uploads) | n/a (not on mobile) |
| V5 | Voice job status (`VoiceLab.tsx`) | missing | GetVoiceJobStatus, GetTask | polling, expo-audio playback | M | Standard | n/a (not on mobile) |
| V6 | Voice enrol / remove in settings (`settings/VoiceSettings.tsx`) | missing | RegisterVoice, RemoveVoice | expo-audio | M | Independent review | n/a (not on mobile) |
| **Playground** | | | | | | | |
| P1 | Magic Mirror (`playground/MagicMirror.tsx`) | missing | AnalyzeFace, GetTask | expo-camera / expo-image-picker, upload link | M | Review (faces, uploads) | n/a (not on mobile) |
| P2 | Twin-O-Meter (`TwinOMeter.tsx`) | missing | CompareFaces, GetTask | same | M | Review | n/a (not on mobile) |
| P3 | Crowd Scanner / FindMe (`FindMe.tsx`) | missing | FindFaceInCrowd, GetTask | same | M | Review | n/a (not on mobile) |
| P4 | Characters and workspaces (`CharacterManager.tsx`, `WorkspaceSelector.tsx`, `contexts/WorkspaceProvider.tsx`) | missing | GetWorkspaces, GetWorkspaceFaces, CreateWorkspace, AddWorkspaceCharacter, VerifyInWorkspace | camera, upload link | L | Review (faces) | n/a (not on mobile) |
| P5 | Games: Snake, Pong, lobby (`MiniGameLobby.tsx`, `SnakeGame.tsx`, `PongGame.tsx`) | missing | - | react-native-reanimated / gesture, no backend | M | Standard | n/a (not on mobile) |
| **Security** | | | | | | | |
| S1 | Security center and audit logs (`pages/SecurityPage.tsx`) | missing | GetSecurityAuditLogs | - | S | Review (audit data) | n/a (not on mobile) |
| **Profile and settings** | | | | | | | |
| PR1 | Profile page with usage stats (`pages/ProfilePage.tsx`) | partial: `app/(tabs)/profile.tsx` shows name, id, email, member-since from the stored user; no stats, no avatar | GetMe | - | S | Review | Confirmed: name, id, email, member since, Sign Out |
| PR2 | Update profile (`pages/SettingsPage.tsx`) | missing UI; operation declared + `apiService.updateProfile` | UpdateProfile | - | S | Review | n/a (not on mobile) |
| PR3 | Blaze settings / preferences (`pages/BlazeSettingsPage.tsx`) | missing | UpdatePreferences | - | S | Standard | n/a (not on mobile) |
| PR4 | Face settings: enrol/remove (`settings/FaceSettings.tsx`) | missing (RemoveFace declared but broken, F-03) | RegisterUserFace, RemoveFace | expo-camera | M | Independent review (biometrics) | n/a (not on mobile) |
| PR5 | Voice settings (`settings/VoiceSettings.tsx`) | missing (= V6) | RegisterVoice, RemoveVoice | expo-audio | - | Independent review | n/a (not on mobile) |
| PR6 | Push settings (`settings/PushNotificationSettings.tsx`) | missing (= T3) | push ops | expo-notifications | - | Independent review | n/a (not on mobile) |
| PR7 | Users list (`pages/UsersPage.tsx`, `UsersList.tsx`) | missing; see F-04 before building it | GetUsers | - | S | Review (personal data) | n/a (not on mobile) |

Web-only pages with no mobile intent assumed (decision for developer): landing page, privacy, terms (`web/src/pages/LandingPage.tsx`, `pages/legal/*`), service worker caching (`web/src/sw.ts`, offline page), browser notifications hook.
Mobile-only extras: `Items` tab (SQLite template, `app/(tabs)/items.tsx`, `hooks/use-items.ts`, `services/db.ts`), hard-coded Home dashboard (`app/(tabs)/index.tsx`), `DeleteChat`.

Counts: done 4 (A1, A2, C1, C2), partial 9 (A3, A6, A7, C3, C4, C5, V1, V2, PR1), missing 27. PR5 and PR6 are counted as separate rows although they duplicate V6 and T3.

## 3. Findings (code-reviewer severity scheme)

Only evidence-based items. "Unverified at runtime" means read from code, not executed.

| ID | Sev | Finding | Evidence | Why it matters | Smallest fix |
| :-- | :-- | :-- | :-- | :-- | :-- |
| F-01 | High | Apollo error link uses the removed Apollo Client 3 API, so the UNAUTHENTICATED branch never runs; there is no working 401/expiry handling | `mobile/App/libs/apollo-client.ts:75-83` destructures `graphQLErrors`/`networkError` from `onError`; installed `@apollo/client` is 4.0.7 whose handler receives `{ error, ... }`; `tsc` reports TS2339 on lines 75. Same dead pattern in `services/api.ts:116-123`. The axios 401 interceptor (`api.ts:50-57`) only covers the axios client, which is used for `/health` only (`api.ts:398`). Backend tokens last 7 days and expiry yields `UNAUTHENTICATED` (`backend/src/auth/security.ts:40`, `resolvers/types/context.ts:98-103`) | After expiry the UI stays "signed in" and every call fails; token is cleared nowhere | Use `ErrorLink` + `CombinedGraphQLErrors.is(error)` exactly as `web/src/lib/apolloClient.ts` does; on UNAUTHENTICATED clear token and set AuthContext user to null |
| F-02 | High | Mobile cannot send file uploads through GraphQL | `libs/apollo-client.ts:13` uses `createHttpLink` (JSON only); web has a multipart `createUploadLink` (`web/src/lib/uploadLink.ts`) and sends `apollo-require-preflight` (`web/src/lib/apolloClient.ts:50-53`); backend has `csrfPrevention: true` (`backend/src/index.ts:~181`). `api.ts:364` passes a raw `image` variable | Blocks face login, document upload, voice, playground, image-based slices | Add an upload link for React Native (file objects `{uri,name,type}` in FormData) before slices 2, 7, 9; design decision |
| F-03 | High | `services/api.ts` references operations that are not exported or not defined; several methods fail at runtime | imports `GET_USERS`, `CREATE_USER`, `GENERATE_GEMINI_CONTENT`, `CHANGE_PASSWORD_MUTATION` (`api.ts:8-17`) which `operations.ts` does not export (TS2305); uses undeclared `CHAT_HISTORY`, `SEND_MESSAGE_WITH_RESPONSE`, `REMOVE_FACE` (`api.ts:296,314,338`, TS2304). No `createUser` mutation exists in the backend schema | `changePassword`, `getUsers`, `createUser`, `generateGeminiContent`, `removeFace`, `getChatHistory` fail; `useAuth.changePassword` is advertised but broken (auth feature) | Export the missing documents (or delete dead methods); drop `createUser`; goes into Phase 2 `tsc` cleanup |
| F-04 | High (backend; confirmed from code, not run) | `users` query is unauthenticated and returns every user | `backend/src/resolvers/queries/userQueries.ts:5` returns `prisma.user.findMany()` with no auth check; `backend/src/resolvers/index.ts:25-29` spreads `authResolvers.Query` first and `queryResolvers` after (`queries/index.ts` includes `...userQueries`), so this unguarded version overrides the admin-only one at `backend/src/resolvers/auth/resolvers.ts:50-52` (`requireRole(context, UserRole.ADMIN)`) | Exposes emails and names of all users; also web `UsersPage` shows them to any role | Delete the duplicate in `userQueries.ts` or add the same guard; propose to developer, do not change shared backend without approval |
| F-05 | Medium | Logout does not clear the Apollo cache | `services/api.ts:382-384` and `hooks/use-auth.tsx` signOut only clear SecureStore; web does `client.clearStore()` (`web/src/contexts/AuthContext.tsx:~190`). Cache policy is cache-first/cache-and-network (`libs/apollo-client.ts:121-131`) | Next user on the same device can see the previous user's cached chats | Call `apolloClient.clearStore()` in signOut and on UNAUTHENTICATED |
| F-06 | Medium | Web `GetTask` is invalid against the schema | `web/src/graphql/tasks.ts:23` declares `$id: String!`; schema is `task(id: ID!)` (`schema.ts:255`); graphql-js validation: `Variable "$id" of type "String!" used in position expecting type "ID!"` | Polling for image, voice and playground tasks is rejected by the server in 5 web components (unverified at runtime; Apollo Server runs the same validation) | Change to `$id: ID!` in web; use `ID!` when mobile adds the op (report to developer, web is out of this audit's edit scope) |
| F-07 | Medium | Home tab shows fabricated metrics and claims | `app/(tabs)/index.tsx` (`stats`: "2,847", "15.2K", "98.7%"; `recentActivity` hard-coded; "Join 50,000+ Happy Users", "99.9% uptime", "Bank-level encryption") | Misleading for a product handling user data; no API behind it | Replace with real data (`myTasks`, `chats`) or remove |
| F-08 | Medium | Voice screen sends user text to a third party and fabricates results | `app/features/voice/index.tsx:82-86` GETs `api.mymemory.translated.net` with the text in the URL; on any error returns fake "[Traduccion...] text" (`:101-115`); "AI enhancement" is regex replace plus fake 1 s delay (`:~283-310`); "voice clone" = rate/pitch presets (`:46-53`) | Privacy (text leaves system without notice), user told "translated"/"enhanced" when it was not | Route through `ProcessVoiceTask`; remove fake fallbacks; relabel presets |
| F-09 | Medium | Face login is not reachable from the UI | `app/auth/sign-in.tsx` has email/password only; no face component under `components/` or `app/` (check c below) | Plan section 2 row "Auth" overstates mobile | Treat as missing in slice 7 |
| F-10 | Medium | Release configuration still points at placeholder URLs | `libs/environment.ts:54-80` staging/production `https://api-staging.example.com`, `https://api.example.com`; `libs/config.ts` placeholder `APP_NAME`, `SUPPORT_EMAIL` | A non-dev build calls example.com | Make staging/production URLs required env vars that fail fast |
| F-11 | Medium | Attachment upload depends on unset env vars and a client-side unsigned Cloudinary preset | `services/cloudinary-service.ts:2-3,15-16`; `.env.example` has no `EXPO_PUBLIC_CLOUDINARY_*`; `upload_preset` appended with `undefined` (TS2345) | Attachments fail or bypass backend validation; unsigned preset is abusable if exposed | Prefer backend `uploadDocument` (needs F-02); else document the vars and use a restricted preset |
| F-12 | Low | Chat list loads every message of every chat | `libs/` inline `GET_CHATS` in `app/features/chats/index.tsx:23-35` and `operations.ts` GET_CHATS select `messages{...}`; web selects only chat fields (`web/src/graphql/chats.ts:3-12`) | Slow on poor networks (plan Phase 4 low-bandwidth) | Select `id title createdAt updatedAt`; derive preview from history |
| F-13 | Low | Chat detail imports a package that is not installed | `app/features/chats/[id].tsx:23` imports `expo-linear-gradient`; not in `package.json`, not in `node_modules` (tsc TS2307) | Route may fail to bundle/open (unverified at runtime) | `npx expo install expo-linear-gradient` or remove the import |
| F-14 | Low | WebSocket auth key mismatch (no current impact) | mobile sends `connectionParams {authToken}` (`libs/apollo-client.ts:~42`); backend reads `connection.context.authToken` (`backend/src/resolvers/types/context.ts:92`) but passes the graphql-ws `ctx` (`backend/src/index.ts:255`) whose params live in `connectionParams` (unverified) | Subscriptions would be unauthenticated; mobile declares none | Verify before adding subscriptions |
| F-15 | Low | Backend schema declares `deleteAccount` with no resolver | `schema.ts:273`, `schema/auth.ts:479`; no resolver found under `backend/src/resolvers` | Calling it errors | Implement or remove (neither client calls it) |
| F-16 | Low | Repo hygiene in mobile | stray `app/features/voice/.tsx` (0 bytes), `app/features/voice/.txt`, `.txt`, `new.txt`, `work plan.txt`; empty `components/ui/index.tsx`, `hooks/index.ts`, `hooks/use-db.ts`; template `Items` tab; `console.log` of full GraphQL results incl. login response in `services/api.ts:85,99` | Login result (contains JWT) is written to the console log | Remove logs of results; clean files in Phase 2 (also `app/features/chats/image and file.txt`) |
| F-17 | High (functional) | "New chat" never asks for an AI reply: the first message is only stored | `mobile/App/app/features/chats/new.tsx:55-72` calls `createChat` with `messages: [{role:'user', content}]` and then `router.replace` to the chat; `[id].tsx` sends only from the user's send action (`sendMessage` callback ~L240). Backend `createChat` just inserts the chat and messages (`backend/src/resolvers/mutations/chatMutations.ts:33-37`). The AI reply, task row (`taskService.createTask`, feature `chat_response`) and Gemini call all live in `sendMessageWithResponse` (`backend/src/resolvers/sendMessageWithResponse.ts:~165-300`). Web calls `createChat` and then `sendMessage` (`web/src/components/chat/ChatContainer.tsx:457` then `:~480-500`) | Matches the device observation: DB has the user message, no AI message, no task | In `new.tsx`, create the chat with `messages: []` then call `sendMessageWithResponse` with the typed text (or call it from `[id].tsx` on mount for a chat with a single user message and no reply) |

Auth and secrets answers (task item 6):
- Token storage: `expo-secure-store` via `services/storage.ts` (keys `auth_token`, `user_data` from `libs/config.ts`); no AsyncStorage use found for auth. The user object is also kept in SecureStore. Good.
- Token sending: `setContext` link adds `authorization: Bearer <token>` (`libs/apollo-client.ts:22-31`); axios interceptor does the same (`api.ts:39-48`). `credentials: 'include'` on the HTTP link is unnecessary for bearer auth.
- 401 handling: see F-01 (non-functional).
- Hard-coded URLs: dev URLs come from `EXPO_PUBLIC_*` with `10.0.2.2` defaults (`libs/environment.ts`); placeholders in staging/production (F-10); third-party translation URL (F-08); Cloudinary URL (`cloudinary-service.ts:27`). Secret scan of mobile code: see appendix A.
- Plan section 2 "Auth" row: Email sign-in/up and token storage match; "Face login" is declared at API level but not wired (F-09); change password is broken (F-03); voice login missing.

### Findings from the device walkthrough (2026-10-17)

- **F-18 (High, confirmed on device): Voice screen crashes on "Load Sample Text".** Opening `features/voice` works, but pressing "Load Sample Text" raises "Couldn't find a navigation context" (reported at `app/features/voice/index.tsx` line 121), caught by the app ErrorBoundary ("Oops! Something went wrong"). Reproduced twice. The static review found no navigation hook in the screen or the press handler, so the cause is still unknown; see section 7(b) for the next diagnostic steps (read the component stack in Metro, delete the stray `app/features/voice/.tsx`, replace the deprecated `Clipboard` import).
- **F-19 (Medium, confirmed on device): stack-screen headers overlap the Android status bar** (Chats, New Chat, Voice, Items). The clock draws over the title and back arrow. Matches the missing edge-to-edge/safe-area handling in the plan (section 8.3).
- **F-04 confirmed live (High, backend):** an unauthenticated POST to `/graphql` with `{ users { id email name } }` against the local backend returns the user records with no token. The admin-only `users` resolver in `auth/resolvers.ts` is overridden by the unauthenticated one. Tested on the local database only; the same code path should be assumed live wherever this backend is deployed. Not changed (backend change needs the developer's approval).
- **F-17 consequence confirmed:** after "Start Conversation" the database held the user message only (no assistant message, no `tasks` or `task_events` row) and the backend log showed no error.
- **A3 correction:** the plan's statement that mobile already has Face login is wrong at UI level (confirmed in code and on device).
- **Walkthrough limits:** `[id].tsx` was reached only by creating a chat, so sending a second message from the detail screen was not tested. No sign-up, attachment, delete or voice-speech action was performed.

### Backend authorization sweep (independent review, 2026-10-17)

F-04 was fixed (commits 2e92a10 and 43b7a6e). The reviewer's read-only sweep of `backend/src/resolvers` found more problems of the same class. S1, S2, S3 and S5 were then fixed and independently reviewed (commits 324dcee and 289f8d0); all of it is merged into `mobile-parity/phase-0-setup`, not pushed. S4, S6 and S7 were then fixed too (commits 17d9bcb, 5600f67, e866950), together with the token role (every login path now carries the stored role) and a refusal of disabled accounts on password and voice login. All merged locally into `mobile-parity/phase-0-setup`; nothing is pushed.

| # | Severity | Where | Problem |
| :--- | :--- | :--- | :--- |
| S1 (FIXED) | High | `queries/chatQueries.ts:7-20` | `chats(userId)` trusts the argument, so any logged-in user can list another user's chats (and see their email) |
| S2 (FIXED) | High | `queries/chatQueries.ts:23-42` | `chatHistory(chatId)` has no ownership check; any logged-in user can read any chat's messages |
| S3 (FIXED) | High | `subscriptionResolvers.ts:10-26` | `messageAdded` and `messageChunkAdded` need no authentication or ownership; anyone with a chatId receives its messages |
| S4 (FIXED) | Medium | `queries/voiceQueries.ts:10,34-40` | `getVoiceJobStatus(jobId)` returns any job's status and audio URL to any logged-in user |
| S5 (FIXED) | Medium | `auth/authorization.ts:26,34` | `requireRole` allows role strings outside the enum (for example "admin" or "SUPERUSER" pass an ADMIN check) |
| S6 (FIXED, count is admin-only) | Low | `queries/faceServiceQueries.ts:8-16` | Anonymous callers can read how many users have Face ID registered |
| S7 (FIXED) | High | `queries/imageQueries.ts:6-14` | `images(userId)` trusts the argument, so any logged-in user can list another user's image generations (same class as S1; smallest fix: `requireSelfOrAdmin`) |

Follow-ups on the `users` fix: password login, register and voice login put `role: USER` in the token, so an admin who signs in with a password cannot call `users` (only face login uses the stored role); once `users` works, an admin can also pull each user's chats and documents through the nested User fields. Whether either is intended is a requirements question. Spread-order collisions between resolver modules are still unguarded, and `test:authz` is not part of any aggregate test script or CI.

Mobile impact: the chat, image and voice authorization gaps are all fixed, so those slices can be built on them. Open questions from the review: every login path issues a token with `role: USER`, so the admin branches are not reachable with real tokens yet (see the question about password login above); an open WebSocket subscription keeps delivering after the token expires or the user logs out.

## 4. GraphQL operation matrix

Backend column: schema = field exists in SDL and validated; resolver = a resolver function was found (grep) in `backend/src/resolvers`. Status: OK = mobile equivalent declared and used; Declared = declared in mobile but not used from a screen or broken; Missing = no mobile equivalent.

| # | Web op | Web source | Mobile op | Backend exists | Status |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Login | `graphql/users.ts` (also raw fetch in `AuthContext.tsx:85`) | Login (`operations.ts`) | schema + resolver (`auth/resolvers.ts:172`) | OK |
| 2 | Register | `graphql/users.ts` / `AuthContext.tsx:143` | Register | schema + resolver (`:120`) | OK |
| 3 | GetMe | `graphql/users.ts` | Me (fewer fields: no preferences, totals, hasVoiceRegistered) | schema + resolver (`:35`) | OK (field drift) |
| 4 | GetUsers | `graphql/users.ts` | none (api.ts references missing `GET_USERS`) | schema + resolver (see F-04) | Missing |
| 5 | UpdateProfile | `graphql/users.ts` | UpdateProfile | schema + resolver (`:212`) | Declared (no screen) |
| 6 | UpdatePreferences | `graphql/users.ts` | none | schema + resolver (`mutations/userMutations.ts:6`) | Missing |
| 7 | ChangePassword | `graphql/users.ts` | none (api.ts references missing `CHANGE_PASSWORD_MUTATION`) | schema + resolver (`:247`) | Missing / broken |
| 8 | LoginWithFace | `graphql/users.ts` | LoginWithFace | schema + resolver (`faceAuthMutations.ts:120`) | Declared (no UI, no upload link) |
| 9 | RemoveFace | `graphql/users.ts` | RemoveFace | schema + resolver (`:210`) | Declared (broken in api.ts) |
| 10 | RegisterUserFace | `graphql/users.ts`, inline in `Register.tsx`, `FaceSettings.tsx` | none | schema + resolver (`:22`) | Missing |
| 11 | AddWorkspaceCharacter | `graphql/users.ts`, inline in `CharacterManager.tsx` | none | schema + resolver (`:67`) | Missing |
| 12 | RegisterVoice (users.ts, var `$audio`) | `graphql/users.ts` | none | schema + resolver (`mutations/voiceCloning.ts:16`) | Missing |
| 13 | RemoveVoice | `graphql/users.ts` | none | schema + resolver (`voiceCloning.ts:87`) | Missing |
| 14 | GetVoiceLoginChallenge | `graphql/users.ts` | none | schema + resolver (`auth/resolvers.ts:67`) | Missing |
| 15 | LoginWithVoice | `graphql/users.ts` | none | schema + resolver (`:296`) | Missing |
| 16 | GetSecurityAuditLogs | `graphql/users.ts` | none | schema + resolver (`:103`) | Missing |
| 17 | GetChats | `graphql/chats.ts` | GetChats (x2: `operations.ts`, inline `chats/index.tsx`) | schema + resolver (`queries/chatQueries.ts:7`) | OK (selection drift F-12) |
| 18 | GetChatHistory | `graphql/chats.ts` | ChatHistory (`operations.ts`, unused) and GetChatHistory (inline `[id].tsx`) | schema + resolver (`chatQueries.ts:23`) | OK |
| 19 | CreateChat | `graphql/chats.ts` | CreateChat (x2) | schema + resolver (`chatMutations.ts:7`) | OK |
| 20 | DeleteMessage | `graphql/chats.ts` (unused by web) | none | schema + resolver (`messageMutations.ts:54`) | Missing (not a web feature) |
| 21 | SendMessageWithResponse | `graphql/chats.ts` | SendMessageWithResponse (x2; lacks `$activeDocumentIds`) | schema + resolver (`sendMessageWithResponse.ts:154`) | OK (argument drift) |
| 22 | UploadDocument | `graphql/chats.ts` | none | schema + resolver (`documentMutations.ts:7`) | Missing |
| 23 | GetDocumentLifecycle | `graphql/chats.ts` | none | schema (via `me.documents`) | Missing |
| 24 | GenerateGeminiContent | `graphql/gemini.ts` (unused by web) | none (api.ts references missing const) | schema + resolver (`geminiMutations.ts:23`) | Missing (not a web feature) |
| 25 | GetFaceServiceStatus | `graphql/gemini.ts` (unused by web) | FaceServiceStatus | schema + resolver (`faceServiceQueries.ts:8`) | Declared |
| 26 | GetImages | `graphql/images.ts` (unused by web) | none | schema + resolver (`imageGenerationResolvers`/`imageQueries.ts:6`) | Missing (not a web feature) |
| 27 | GenerateImage | `graphql/images.ts` (unused by web) | none | schema + resolver (`imageMutations.ts:15`) | Missing (not a web feature) |
| 28 | GenerateAIImageVariants | `graphql/images.ts` | none | schema + resolver (`imageGenerationResolvers.ts:194`) | Missing |
| 29 | GenerateAIImage | `graphql/images.ts` (unused by web) | none | schema + resolver (`:72`) | Missing (not a web feature) |
| 30 | GetAIImageStatus | `graphql/images.ts` | none | schema + resolver (`:39`) | Missing |
| 31 | AnalyzeFace | `graphql/playground.ts` | none | schema + resolver (`faceAuthMutations.ts:255`) | Missing |
| 32 | CompareFaces | `graphql/playground.ts` | none | schema + resolver (`:312`) | Missing |
| 33 | FindFaceInCrowd | `graphql/playground.ts` | none | schema + resolver (`:351`) | Missing |
| 34 | GetPushNotificationConfig | `graphql/push.ts` | none | schema + resolver (`queries/pushQueries.ts:5`) | Missing |
| 35 | GetMyPushSubscriptions | `graphql/push.ts` | none | schema + resolver (`:9`) | Missing |
| 36 | RegisterPushSubscription | `graphql/push.ts` | none | schema + resolver (`mutations/pushMutations.ts:5`); Web Push shape only | Missing |
| 37 | UnregisterPushSubscription | `graphql/push.ts` | none | schema + resolver (`:17`) | Missing |
| 38 | TrackPushEngagement | `graphql/push.ts` | none | schema + resolver (`:30`) | Missing |
| 39 | GetMyTasks | `graphql/tasks.ts` | none | schema + resolver (`queries/taskQueries.ts:13`) | Missing |
| 40 | GetTask | `graphql/tasks.ts` | none | schema + resolver (`taskQueries.ts:5`); web document invalid (F-06) | Missing |
| 41 | ProcessVoiceTask | `graphql/voice.ts` | none | schema + resolver (`voiceTaskResolvers.ts:6`) | Missing |
| 42 | RegisterVoice (voice.ts, var `$referenceAudio`) | `graphql/voice.ts` | none | same field as #12 | Missing |
| 43 | CloneVoice | `graphql/voice.ts` | none | schema + resolver (`voiceCloning.ts:127`) | Missing |
| 44 | GetVoiceJobStatus | `graphql/voice.ts` | none | schema + resolver (`queries/voiceQueries.ts:7`) | Missing |
| 45 | GetWorkspaces | inline `contexts/WorkspaceProvider.tsx:7` | none | schema + resolver (`workspaceResolvers.ts:8`) | Missing |
| 46 | GetWorkspaceFaces | inline `playground/CharacterManager.tsx:47` | none | same root field as #45 | Missing |
| 47 | VerifyInWorkspace, CreateWorkspace | inline `CharacterManager.tsx:66`, `WorkspaceSelector.tsx:11` | none | schema + resolver (`faceAuthMutations.ts:168`, `workspaceResolvers.ts:36`) | Missing |

Counting note: the table has 48 numbered lines because #47 holds two inline operations and #12/#42 are two definitions of the same name `RegisterVoice`. Unique operation names = 47 (43 under `web/src/graphql` + `GetWorkspaces`, `GetWorkspaceFaces`, `VerifyInWorkspace`, `CreateWorkspace`); #45 and #46 hit the same root field `myWorkspaces`. Mobile-only: `DeleteChat` (`chats/index.tsx:38`; schema + resolver `chatMutations.ts:76`; no web equivalent found in `web/src/graphql`).

Mobile-declared operations absent from the backend schema: none in GraphQL documents. `createUser` (`api.ts` CREATE_USER import) has no document and no backend field (F-03). Drift: argument drift on SendMessageWithResponse (missing `activeDocumentIds`), selection drift on Me/GetChats, name drift (`ChatHistory` vs `GetChatHistory`; two documents named `GetChats`, `CreateChat`, `SendMessageWithResponse` in one app, which share Apollo cache keys but are different documents).

REST usage: web uses `fetch` to GraphQL for Login/Register (`AuthContext.tsx`), Cloudinary upload API (`web/src/services/cloudinary.ts:19`), an AI engine wake-up ping (`AuthContext.tsx:57`, `VITE_AI_ENGINE_URL`). Mobile: axios client to `API_BASE_URL` only for `GET /health` (`api.ts:398`; backend route exists, `backend/src/index.ts:268`), Cloudinary upload (`cloudinary-service.ts:27`), third-party translation (`voice/index.tsx:84`). No mobile call to other backend REST routes was found.

## 5. Mobile screen inventory

| Route / file | Lines | What the code really does | Observed on device |
| :-- | :-- | :-- | :-- |
| `app/_layout.tsx` | 54 | Providers: Apollo, SafeArea, React Query, Auth, ErrorBoundary. Declares a route `auth` that does not exist as a screen (routes are `auth/sign-in`, `auth/sign-up`). `apolloClient` can be null (TS2322) | Not walked |
| `app/auth/sign-in.tsx` | 128 | Email + password form (zod), calls `signIn`, redirects to tabs. No face/voice | Works; email and password only, no face or voice entry |
| `app/auth/sign-up.tsx` | 153 | Name/email/password form, calls `signUp` | Renders; not submitted (would create a user) |
| `app/(tabs)/index.tsx` | 353 | Static marketing/dashboard: hard-coded stats, activity, testimonial CTA; 3 buttons route to chat/image/voice (F-07) | Confirmed placeholder stats and activity; Chat/Image/Voice cards navigate |
| `app/(tabs)/items.tsx` | 59 | Template CRUD on local SQLite (`services/db.ts`), unrelated to product | "Loading..." then an empty list with "Add Item"; template screen |
| `app/(tabs)/profile.tsx` | 60 | Read-only profile from AuthContext user + Sign Out | Matches; Sign Out works |
| `app/features/chats/index.tsx` | 420 | Real: `chats(userId)`, search, delete (`deleteChat`), pull to refresh | Works; empty state shown; header under the status bar |
| `app/features/chats/new.tsx` | 272 | Real: `createChat` with an initial user message | Works; creates chat and navigates to the conversation |
| `app/features/chats/[id].tsx` | 617 | Real: history (limit 50), `sendMessageWithResponse`, attachment via Cloudinary (F-11); imports missing `expo-linear-gradient` (F-13) | Opens after create and shows the user message; no AI reply followed (F-17). Screen rendered, so F-13 was not reproduced at runtime |
| `app/features/image.tsx` | 12 | Placeholder text "Image Tab" | Confirmed placeholder; no header or back control |
| `app/features/voice/index.tsx` | 935 | Fully local/third-party: expo-speech TTS, regex "enhance", MyMemory translation with fake fallback, keyword emotion guess, save/share text file (F-08). Uses no backend voice operation | Renders; "Load Sample Text" raises a navigation-context render error caught by the ErrorBoundary (F-18) |
| `app/features/voice/.tsx`, `.txt` | 0 / 14 | Stray files (Metro warns about the `.tsx`) | n/a |
| `app/+not-found.tsx` | 16 | Not found screen | Not walked |

Libraries/hooks: `libs/apollo-client.ts` (Apollo 4 client, defective error link), `services/api.ts` (405 lines, 41 tsc errors, mixed axios + Apollo), `services/storage.ts` (SecureStore), `hooks/use-auth.tsx`, `hooks/use-chat-messages.ts` (broken, 5 tsc errors, appears unused), `components/ui/*`.

## 6. Suggested slice-order adjustments (proposals only, the developer decides)

1. Put "Foundation" items that unblock everything ahead of Slice 1: fix the Apollo 4 error link and 401 handling (F-01), add the upload link (F-02), repair `operations.ts`/`api.ts` (F-03), clear cache on logout (F-05). The plan places some of this in Phase 2; F-02 is a prerequisite for slices 2, 7, 9.
2. Add a small "Home tab and cleanup" step early: remove fabricated stats (F-07) and the Items template, so device walkthroughs do not mislead.
3. Slice 3 (push) needs a backend design decision first (Web Push only, F-03 table row T3): either add a platform/token type for Expo or FCM, or scope mobile to in-app Recent Tasks and defer push. Consider doing Recent Tasks (T1/T2) before push.
4. Slice 5 (Voice): the existing 935-line screen is mostly local; propose replacing it with backend-backed `ProcessVoiceTask` (small) before voice clone (large).
5. Slice 8 (Security center) is small and read-only; it could move earlier as a low-risk way to exercise the new auth foundation.
6. Verify and raise F-04 and F-06 with the developer before slices 6 (PR7 users) and 4/5/9 (task polling).

## 7. Targeted checks (coordinator questions)

**(a) Chat send, no AI reply.** Mobile uses two different paths. New chat (`app/features/chats/new.tsx:55-72`) only calls `createChat` (stores the typed text as a message, no AI). Sending inside an existing chat (`app/features/chats/[id].tsx`, `sendMessageWithResponse` mutation) is the same mutation web uses (`web/src/graphql/chats.ts`, `ChatContainer.tsx:314`), minus `activeDocumentIds`. Web's flow is `createChat` then `sendMessage` (`ChatContainer.tsx:457-500`); the mobile new-chat screen skips the second call. The task row is created only inside `sendMessageWithResponse` (`backend/src/resolvers/sendMessageWithResponse.ts`, `taskService.createTask`), so no task row is expected when only `createChat` ran. Finding F-17. Not determined from code: whether a send from `[id].tsx` also yields no reply (needs the device/backend log; failure candidates there are `AIManager.checkQuota` and the Gemini key/quota on the backend).

**(b) Voice screen "Couldn't find a navigation context" on Load Sample Text.** Not determinable statically. Facts: `app/features/voice/index.tsx` (button at L621, handler `insertSampleText` L412 only calls `setText`) uses no navigation hook (`useNavigation`, `useRouter`, `useIsFocused`, `useFocusEffect` are absent from the whole `app/`, `components/`, `hooks/` tree); `components/ui/error-boundary.tsx` has no navigation hook either; only one copy of `@react-navigation/core` (7.12.4) and `native` (7.1.18) is installed, so a duplicate-package context mismatch is unlikely. L121 is the component's first line, so the reported frame is probably only the component boundary. The re-render after `setText` mounts the "Ready ... tone detected" row and uses `detectedEmotion`/`estimatedDuration()`; none uses navigation. Remaining candidates to test on device (smallest first): (1) delete the stray empty route file `app/features/voice/.tsx` (an unnamed route inside the voice stack that Metro already warns about); (2) read the component stack from Metro/`debugger-log-registry` to find which child throws; (3) the deprecated `Clipboard` import from `react-native` (L13) is unrelated to navigation but should be replaced by `expo-clipboard`, which is already a dependency. I did not find a code cause and do not claim one.

**(c) Face login in sign-in.** Not wired. `app/auth/sign-in.tsx` renders email and password only; no component named FaceCapture or camera-login exists in `app/`, `components/`, `hooks/` (the only camera code is `components/file-picker.tsx` for attachments). `loginWithFace` exists only in `services/api.ts:362` and `LOGIN_WITH_FACE` in `services/graphql/operations.ts`; nothing calls it. The plan's "mobile has Face login" is therefore wrong at UI level (F-09).

**(d) Token storage, 401, URLs, keys.** Token: `expo-secure-store` (`services/storage.ts`), no AsyncStorage dependency or use. 401: non-functional (F-01). Hard-coded URLs: only placeholder staging/production URLs (`libs/environment.ts:43-61`, F-10), the MyMemory translation URL (`voice/index.tsx:85`, F-08) and Cloudinary (`cloudinary-service.ts:25`). Pattern scan of `mobile/App/{app,components,hooks,libs,services,utils,constants}` for API keys, `sk-`/`AIza` strings, bearer literals and hard-coded passwords found none. Cloudinary cloud name/preset come from `EXPO_PUBLIC_*` env vars (public by design in Expo; an unsigned preset is therefore client-visible, F-11).

**(e) tsc.** `npx tsc --noEmit`: 85 errors in 16 files. Top files: `services/api.ts` 41, `app/features/chats/[id].tsx` 7, `libs/apollo-client.ts` 6, `hooks/use-chat-messages.ts` 5, `components/file-picker.tsx` 5, `app/auth/sign-up.tsx` 4, `app/auth/sign-in.tsx` 3; then 2 each in `cloudinary-service.ts`, `use-theme.ts`, `use-form.ts`, `chats/new.tsx`, `chats/index.tsx`; 1 each in `ui/icon.tsx`, `ui/form.tsx`, `ui/button.tsx`, `app/_layout.tsx`. By code: TS2339 44, TS2304 11, TS2322 10, TS7031 4, TS2345 4, TS2305 4, TS2769 2, TS2300 2, others 1 each.

## 8. Open questions for the developer

1. Is the `users` query meant to be public/any-authenticated, or admin-only? (F-04)
2. Should mobile push use Expo Push, native FCM/APNs, or defer? Backend currently supports Web Push only.
3. Are the web-only pages (landing, privacy, terms) expected on mobile (links to the website are enough)?
4. Is attachment upload meant to go through Cloudinary from the device (current mobile behaviour) or through `uploadDocument` (backend ingestion/RAG)? Does the chat attachment on web use RAG documents or only Cloudinary?
5. Why does the mobile voice screen not use the backend voice tasks; is the on-device approach intentional (offline, cost)?
6. Is `DeleteChat` used anywhere on web (not found in `web/src/graphql`; checked only the graphql folder and inline gql in components, not `Sidebar.tsx` raw usage)?
7. Which staging and production API URLs should the mobile build use?
8. Is the third-party MyMemory translation acceptable from a data-handling standpoint, or must text go through the backend?

## 9. Limitations of this review

- Read-only; no server, emulator or Argent used. All "works / does not work" statements come from code and `tsc`/graphql-js validation, not execution. "Observed on device" is left to the device walkthrough.
- `backend/.env`, `.env.local` were not opened.
- Web components were read for operation use and feature scope, not line by line (large files: `ChatContainer.tsx` 858 lines, `VoiceLab.tsx` 653, `VoiceTools.tsx` 585 were not read in full). Effort and risk ratings are estimates.
- Resolver presence was checked by grep for the function name; resolver logic, authorization of `chats(userId)`/`images(userId)` etc. were not reviewed.
- Inline mobile operations were not individually validated (they are subsets of validated documents).
- Web `Sidebar.tsx`, `Header.tsx`, `Layout.tsx` and `ContextPanel.tsx` were not opened; features C8 and T4 are inferred from file names plus imports.
- Mobile: `components/ui/*`, `hooks/use-theme.ts`, `utils/*` not reviewed.

## Appendix A. Notes

- Validation method: a script in the session scratchpad extracted the SDL from `backend/src/schema/schema.ts` and `schema/auth.ts` (the `schema/imageGeneration.ts` SDL is not imported anywhere), built it with `@graphql-tools/schema` from `backend/node_modules`, and ran graphql-js `validate` on each `gql` constant. No server was started and nothing was written to the repo.
- Resolver presence for the 47 web operations plus `deleteChat`, `deleteAccount`, `generateMultipleImages`, `pushDeliveryMetrics`: all found by grep except `deleteAccount` (F-15).
- F-04 detail: the three `Query.users` definitions are `schema.ts:238`, `schema/auth.ts:470` (same field extended twice; harmless), and two resolvers (`auth/resolvers.ts:50` admin-only, `queries/userQueries.ts:5` open). The latter wins by spread order.

### Auth hardening (2026-10-24) and what is still open

Fixed, reviewed and merged locally into `mobile-parity/phase-0-setup` (not pushed): no hard-coded JWT fallback secret (server exits at startup if `JWT_SECRET` is missing, short or the example value); voice webhook needs `WEBHOOK_SECRET` (secret in the callback URL path, or the `x-webhook-secret` header; rejects everything when unset); role and active flag re-read from the database on every request, so demotion, disabling or deleting an account applies to existing tokens at once; a database outage during that lookup gives a retryable "temporarily unavailable" error instead of a rejected session; web app clears an expired session on load, signs out when it expires, and sends any rejected session to login.

Deployment actions for the developer:
- Set `JWT_SECRET` (32+ characters, unique) in every deployed environment. A deployment that was silently using the old fallback will now refuse to start, and everyone is logged out once.
- Set `WEBHOOK_SECRET` (16+ characters). Until then voice-engine callbacks get 401 and voice jobs rely on the polling fallback.
- Run the row-level-security check on the live Supabase project (`dvdlspbbiwqccqwushff`; the connected tool account cannot see it): `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';`

Still open (decisions or follow-ups):
- A subscription that is already open keeps streaming after its account is disabled or demoted (graphql-ws builds the context once per subscription). No client subscribes today.
- The webhook secret in the URL can appear in reverse-proxy or platform access logs; a per-job token or a header sent by the engine would be safer. A caller holding the secret can replay callbacks and set any `audioUrl`.
- Changing a password does not revoke existing tokens (only role and active flag are re-checked).
- Existing, not introduced here: the response cache and GraphQL rate limiter read `user.id` while the context has `userId`, so the cache never runs for signed-in users and rate limiting is per IP; `initSentry` sends default PII and would capture URLs if it were ever enabled; `/debug-sentry` and `/debug-tables` are exposed in all environments; `pollJobStatus` omits the `x-service-key` header that `getJobStatus` sends; `web/package-lock.json` is out of sync with `package.json` (`npm ci` fails); `pushQueries.ts:26` compares the role with a literal.
