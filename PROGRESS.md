# Progress

Last updated: 2026-10-31

## Now
Slice 6 (profile and settings) plus its security hardening are committed on `mobile-parity/slice-6-profile-settings` (4 commits, nothing pushed). Waiting on the developer for two deployment facts (below) and a decision on the next slice.

## Next
1. Developer: confirm how many proxies sit in front of the backend (Render) so `app.set("trust proxy", N)` can be set in `backend/src/index.ts`; until then the per-address sign-in limit, the face limit and the general GraphQL limiter see one shared address.
2. Developer: check the Render service instance count (Settings, Scaling). More than 1 instance means the in-memory attempt counters (`backend/src/auth/passwordAttempts.ts`) must move to Redis.
3. Third independent review (`reviewer-opus-medium`) of commits `15ece71` and `0946adc` if wanted; the last review was BLOCK before the final fixes.
4. Pick the next slice: 5b voice cloning (needs a short plan first), 3b push (deferred to the end), or Phase 4 hardening (after the above).

## Done recently
- 2026-10-31: sign-in limit per email and network (IPv6 /64), ceiling of 20 per email, unknown-email audit and metrics, face login limit, WebSocket address, mobile late-token guard (`15ece71`, `0946adc`, `9d9a805`, plus a docs commit).
- 2026-10-31: two independent reviews of the sign-in and session work; all clear-cut findings fixed and mutation-checked.
- 2026-10-31: `qa-profile-sign-out-other-devices` passed twice in a row and `qa-auth-signin-home-signout` once on the final code.

## Open questions / blockers
- `trust proxy` hop count and Render instance count (see Next 1 and 2).
- Retention period for `security_audit_logs` (legal requirement, not decided).
- Migration `20261026_session_version` was edited (lock timeout); safe only if it was never applied outside the local database.
- Other face endpoints (`compareFaces`, `findFaceInCrowd`, `verifyFaceInWorkspace`) are unlimited by decision, to be done separately.

## Context to remember
- Plan and full history: `mobile-web-parity-implementation_plan.md` (START HERE, sections 8.12 and 8.13).
- Start the environment: `systemctl --user start docker-desktop`; `docker start xemora-dev-postgres xemora-dev-redis`; backend `cd backend && ./scripts/local-env.sh npm run dev` (run in background); Metro `cd mobile/App && npx expo start --dev-client --port 8082`; emulator `~/Android/Sdk/emulator/emulator -avd Xemora_Pixel_API_35 -gpu swiftshader_indirect -no-audio -no-boot-anim` (host GPU crashed twice), then `adb reverse tcp:8082 tcp:8082`.
- Checks: backend `npx tsc --noEmit`, `./scripts/local-env.sh npm run test:authz` and `test:tasks`; mobile `npm test`, `npx tsc --noEmit`, eslint, prettier; flows in `mobile/App/.argent/flows/`.
- A flow that dies mid-run leaves the app signed in; sign out by hand before rerunning.
- Uncommitted on purpose: `.claude/` and this file.
