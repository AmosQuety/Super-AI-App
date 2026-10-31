# Progress

Last updated: 2026-10-31 (late)

## Now
Slice 6 (profile and settings) and its security hardening are committed on `mobile-parity/slice-6-profile-settings` after three independent reviews (nothing pushed, so nothing is deployed). Waiting on the developer to push/deploy and read one diagnostic log line from Render so the proxy count can be set.

## Next
1. Developer: push the branch (or merge it into the branch Render deploys) when ready; I do not push unless asked. The Render build runs `prisma migrate deploy`, which will apply `20261026_session_version`.
2. Render, service Environment tab: add `FORWARDING_DIAGNOSTIC` = `true`, deploy, open the app or the site once, then open Logs. Look for a line containing `"diagnostic":"forwarding-headers"` and send it to me (it holds only addresses a caller already sent; remove anything you do not want to share).
3. From that line I choose the number for `TRUST_PROXY_HOPS` (too low is harmless, too high lets callers forge an address). Set it in Environment, remove `FORWARDING_DIAGNOSTIC`, redeploy. A bad value stops the server at startup (check Deploys).
4. In the SAME deploy as step 3, fix the general rate limiter: in `backend/src/auth/rate-limiting.ts` change `ipKeyGenerator(req)` to `ipKeyGenerator(req.ip ?? '')`. Today it never limits anything. Do not apply it before the proxy count is set, or the 100-per-minute cap would apply to the whole app together.
5. Pick the next slice: 5b voice cloning (needs a short plan first), 3b push (deferred to the end), or Phase 4 hardening.

## Done recently
- 2026-10-31: third independent review fixed: forwarding diagnostic that actually reaches Render's logs, WebSocket address by the same rule as HTTP, face engine faults no longer count as guesses, safer address parsing, stricter `TRUST_PROXY_HOPS`, Change Password "sign in again" notice (`e29522d`, `9cf7593`).
- 2026-10-31: `TRUST_PROXY_HOPS` setting (`88b3cec`).
- 2026-10-31: sign-in limit per email and network (IPv6 /64), ceiling of 20 per email, unknown-email audit (capped) and metrics, face login limit, WebSocket address, mobile late-token guard (`15ece71`, `0946adc`).
- 2026-10-31: flows `qa-profile-sign-out-other-devices` and `qa-auth-signin-home-signout` each passed twice in a row on the final code (the sign-in flow failed twice earlier under heavy machine load, see the plan).
- 2026-10-31: Render would not open because the Wi-Fi resolver failed on `onrender.com`; fixed with public DNS on that connection (see Context).

## Open questions / blockers
- Proxy count for Render (Next 2 and 3). Also whether callers can reach the `*.onrender.com` origin directly, bypassing Cloudflare (affects which number is safe).
- Retention period for `security_audit_logs` (legal requirement, not decided).
- Migration `20261026_session_version` was edited (lock timeout); safe only if it was never applied outside the local database.
- Other face endpoints (`compareFaces`, `findFaceInCrowd`, `verifyFaceInWorkspace`) are unlimited by decision, to be done separately.
- One-time sign-out of every user when the password-session hardening ships: not announced yet.
- Render env vars still to confirm: `JWT_SECRET` (32+ characters), `WEBHOOK_SECRET` (16+ characters).
- Until `TRUST_PROXY_HOPS` is set, face sign-in is one shared bucket of 10 per 15 minutes that any stranger can use up (password sign-in is unaffected). Accepted for that period.

## Context to remember
- Plan and full history: `mobile-web-parity-implementation_plan.md` (START HERE, sections 8.12 and 8.13, including the three review rounds).
- Render plan: Free, exactly 1 instance. The in-memory attempt counters (`backend/src/auth/passwordAttempts.ts`) need no Redis, but reset on every deploy and whenever the free service spins down after idle time, so a lockout can quietly end.
- Production logging: the application logger keeps only errors, in files lost on Render, and the console is silenced, so normal request logs do not appear in Render's Logs page. Only `process.stdout` writes (such as the forwarding diagnostic) and uncaught errors do.
- Start the environment: `systemctl --user start docker-desktop`; `docker start xemora-dev-postgres xemora-dev-redis`; backend `cd backend && ./scripts/local-env.sh npm run dev` (run in background); Metro `cd mobile/App && npx expo start --dev-client --port 8082`; emulator `~/Android/Sdk/emulator/emulator -avd Xemora_Pixel_API_35 -gpu swiftshader_indirect -no-audio -no-boot-anim` (the host GPU crashed twice), then `adb reverse tcp:8082 tcp:8082`. After boot a "System UI isn't responding" dialog may appear; tap Wait. When the machine load is high (Docker VM, software-rendered emulator, other projects' builds) flows can fail with "Network error"; check `uptime` and rerun before suspecting the code.
- Checks: backend `npx tsc --noEmit`, `./scripts/local-env.sh npm run test:authz` and `test:tasks`; mobile `npm test`, `npx tsc --noEmit`, eslint, prettier on changed files; flows in `mobile/App/.argent/flows/`.
- A flow that dies mid-run leaves the app signed in; sign out by hand before rerunning.
- DNS (2026-10-31): the Wi-Fi `Hey there` resolver (10.213.117.197) returned NXDOMAIN for `dashboard.render.com` and `onrender.com`. Fixed by setting `ipv4.dns "1.1.1.1 8.8.8.8"` and `ipv4.ignore-auto-dns yes` on that one connection only. Undo: `nmcli connection modify "Hey there" ipv4.dns "" ipv4.ignore-auto-dns no && nmcli device reapply wlp0s20f3`. Other networks are unaffected.
- Uncommitted on purpose: `.claude/`.
