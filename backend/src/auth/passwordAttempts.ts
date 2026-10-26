// Limits how many password answers can be tried for one key (a user's id for "current password"
// checks, a normalised email for sign-in), so neither a stolen session nor a stranger can guess a
// password. An attempt is reserved
// BEFORE the password is compared, so a burst of parallel guesses cannot all start while the
// count is still low. Kept in memory like the other per-user limits here: it resets on restart and
// is per server process, so behind several instances the real ceiling is this limit times the
// instance count.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60_000;

interface AttemptWindow {
  count: number;
  endsAt: number;
}

export type AttemptReservation =
  | { allowed: true; isLastAllowed: boolean }
  | { allowed: false; retryAfterMs: number };

// Sign-in keys come from strangers, so the table must not grow without bound.
export const MAX_TRACKED_KEYS = 10_000;
const windows = new Map<string, AttemptWindow>();

function makeRoomFor(now: number): void {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of windows) {
    if (now >= window.endsAt) windows.delete(key);
  }
  // Still full of live windows: drop the oldest, which are the closest to expiring.
  while (windows.size >= MAX_TRACKED_KEYS) {
    windows.delete(windows.keys().next().value as string);
  }
}

function currentWindow(key: string, now: number): AttemptWindow | undefined {
  const window = windows.get(key);
  if (window && now >= window.endsAt) {
    windows.delete(key);
    return undefined;
  }
  return window;
}

// The window opens with the first attempt. The attempt that reaches the limit restarts it, so
// once the limit is used up the lock always lasts the full window from that moment.
export function reserveAttempt(
  key: string,
  now = Date.now(),
): AttemptReservation {
  const existing = currentWindow(key, now);
  if (!existing) makeRoomFor(now);
  const window = existing ?? { count: 0, endsAt: now + LOCKOUT_WINDOW_MS };
  if (window.count >= MAX_FAILED_ATTEMPTS) {
    return { allowed: false, retryAfterMs: window.endsAt - now };
  }

  window.count++;
  const isLastAllowed = window.count === MAX_FAILED_ATTEMPTS;
  if (isLastAllowed) window.endsAt = now + LOCKOUT_WINDOW_MS;
  windows.set(key, window);
  return { allowed: true, isLastAllowed };
}

// A correct answer gives the user a fresh count.
export function clearFailedAttempts(key: string): void {
  windows.delete(key);
}

export function resetAllFailedAttempts(): void {
  windows.clear();
}

export function trackedKeyCount(): number {
  return windows.size;
}
