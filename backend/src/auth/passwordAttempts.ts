// Limits how many "current password" answers a user can try, shared by every mutation that asks
// for one, so a stolen session cannot be used to guess the password. An attempt is reserved
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

const windows = new Map<string, AttemptWindow>();

function currentWindow(userId: string, now: number): AttemptWindow | undefined {
  const window = windows.get(userId);
  if (window && now >= window.endsAt) {
    windows.delete(userId);
    return undefined;
  }
  return window;
}

// The window opens with the first attempt. The attempt that reaches the limit restarts it, so
// once the limit is used up the lock always lasts the full window from that moment.
export function reserveAttempt(
  userId: string,
  now = Date.now(),
): AttemptReservation {
  const window = currentWindow(userId, now) ?? {
    count: 0,
    endsAt: now + LOCKOUT_WINDOW_MS,
  };
  if (window.count >= MAX_FAILED_ATTEMPTS) {
    return { allowed: false, retryAfterMs: window.endsAt - now };
  }

  window.count++;
  const isLastAllowed = window.count === MAX_FAILED_ATTEMPTS;
  if (isLastAllowed) window.endsAt = now + LOCKOUT_WINDOW_MS;
  windows.set(userId, window);
  return { allowed: true, isLastAllowed };
}

// A correct answer gives the user a fresh count.
export function clearFailedAttempts(userId: string): void {
  windows.delete(userId);
}

export function resetAllFailedAttempts(): void {
  windows.clear();
}
