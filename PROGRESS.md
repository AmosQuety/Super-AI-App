# Progress

Last updated: 2026-10-31 (late)

## Now
The proxy count is known: **`TRUST_PROXY_HOPS=3`** (from Render's diagnostic log: client, Cloudflare edge, Render-internal; the app's own peer is a local proxy). The rate limiter fix is committed together with it on `mobile-parity/slice-6-profile-settings`. Waiting on the developer to set the variable in Render FIRST, verify, and only then push the limiter fix.

## Next
1. Render, service Environment tab: set `TRUST_PROXY_HOPS` = `3` and keep `FORWARDING_DIAGNOSTIC` = `true` for now. Render redeploys the code that is already live (it already understands the variable), so this is safe on its own.
2. When it is live, open the site or app once and read Logs: the new diagnostic lines should show `expressIp` equal to the visitor's real address (the same as `cfConnectingIp`, for example `41.210.145.140`), not `::1`. If they still show `::1`, stop and tell me.
3. Only after step 2 is confirmed: push the branch with the rate limiter fix (commit "fix(backend): make the GraphQL limiter count each client..."). Pushing it BEFORE step 1 and 2 would make the cap of 100 GraphQL requests per minute apply to the whole app together.
4. Then remove `FORWARDING_DIAGNOSTIC` from Render (it prints at most 20 lines per start, harmless but no longer needed) and redeploy.
5. Pick the next slice: 5b voice cloning (needs a short plan first), 3b push (deferred to the end), or Phase 4 hardening.

## Done recently
- 2026-10-31: read Render's diagnostic: forwarding chain is `client, Cloudflare edge (172.x), Render internal (10.x)` with peer `::1`, so three hops; recorded as a test (`trustProxy.test.ts`). Rate limiter fixed (`rateLimiter.test.ts`: 100 per client per minute, separate clients separate), startup warning when `TRUST_PROXY_HOPS` is unset in production.
- 2026-10-31: direct-origin test of the Render backend (`super-ai-app.onrender.com`): every request, including one sent straight to Render's origin address with the service name, was answered through Cloudflare (`server: cloudflare`, `cf-ray`); Render's origin hostname alone returns 404. No direct path found (the real origin address behind Cloudflare is hidden, so this covers only what is publicly reachable). The chain is therefore client, Cloudflare, Render; the exact number still comes from the diagnostic line.
- 2026-10-31: fixed the Vercel preview build failure of `web` (`SettingsPage.tsx` changePassword result was untyped); reproduced locally with the lockfile's Apollo 4.0.4, then `tsc -b` passes and `vite build` succeeds. Committed locally, not pushed.
- 2026-10-31: third independent review fixed: forwarding diagnostic that actually reaches Render's logs, WebSocket address by the same rule as HTTP, face engine faults no longer count as guesses, safer address parsing, stricter `TRUST_PROXY_HOPS`, Change Password "sign in again" notice (`e29522d`, `9cf7593`).
- 2026-10-31: `TRUST_PROXY_HOPS` setting (`88b3cec`).
- 2026-10-31: sign-in limit per email and network (IPv6 /64), ceiling of 20 per email, unknown-email audit (capped) and metrics, face login limit, WebSocket address, mobile late-token guard (`15ece71`, `0946adc`).
- 2026-10-31: flows `qa-profile-sign-out-other-devices` and `qa-auth-signin-home-signout` each passed twice in a row on the final code (the sign-in flow failed twice earlier under heavy machine load, see the plan).
- 2026-10-31: Render would not open because the Wi-Fi resolver failed on `onrender.com`; fixed with public DNS on that connection (see Context).

## Open questions / blockers
- If Render ever changes its proxy chain the number 3 would need to change; the diagnostic (`FORWARDING_DIAGNOSTIC=true`) shows the chain again. A direct-origin bypass of Cloudflare was not found; if one existed, a caller on that path would only have a chain of two entries, and three trusted hops would then believe a forged entry.
- Web dependency heads-up: `web/package.json` allows `@apollo/client ^4.0.4` but the lockfile pins 4.0.4; with Apollo 4.3.x `tsc -b` fails in `web/src/lib/apolloClient.ts` (lines about `errorPolicy` default options). Do not refresh the web lockfile or update Apollo without fixing that; `web/package-lock.json` is also out of sync with `package.json` (`npm ci` fails). Locally `web/node_modules` was installed with `--legacy-peer-deps --ignore-scripts` for checking (gitignored).
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
