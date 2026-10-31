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
  // The limit this window was opened with, so eviction can tell a locked window from a busy one.
  limit: number;
}

export type AttemptReservation =
  | { allowed: true; isLastAllowed: boolean }
  | { allowed: false; retryAfterMs: number };

// Sign-in keys come from strangers, so each table must not grow without bound. Keys are grouped by
// the text before the first ":" (login, password, ...), each with its own table, so a flood of
// junk sign-in keys can never push out the current-password windows of real users.
export const MAX_TRACKED_KEYS = 10_000;
const tables = new Map<string, Map<string, AttemptWindow>>();

function tableFor(key: string): Map<string, AttemptWindow> {
  const separator = key.indexOf(":");
  const namespace = separator === -1 ? "" : key.slice(0, separator);
  let table = tables.get(namespace);
  if (!table) {
    table = new Map();
    tables.set(namespace, table);
  }
  return table;
}

// Locked windows are what the limit exists to keep, so they are the last thing to go. Order of
// removal: expired windows, then the window with the least progress (oldest first on a tie), so
// a flood of one-off junk keys pushes out other junk and not a window that is close to its limit;
// only if every window is locked, the one that ends first. Resetting a partial count by flooding
// is still possible, but only by making the junk windows hold more progress than the target.
function makeRoomFor(table: Map<string, AttemptWindow>, now: number): void {
  if (table.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of table) {
    if (now >= window.endsAt) table.delete(key);
  }
  while (table.size >= MAX_TRACKED_KEYS) {
    table.delete(keyToEvict(table));
  }
}

function keyToEvict(table: Map<string, AttemptWindow>): string {
  let leastProgress: string | undefined;
  let earliestLock: string | undefined;
  for (const [key, window] of table) {
    if (window.count < window.limit) {
      if (leastProgress === undefined || window.count < table.get(leastProgress)!.count) {
        leastProgress = key;
      }
    } else if (earliestLock === undefined || window.endsAt < table.get(earliestLock)!.endsAt) {
      earliestLock = key;
    }
  }
  return (leastProgress ?? earliestLock) as string;
}

function currentWindow(
  table: Map<string, AttemptWindow>,
  key: string,
  now: number,
): AttemptWindow | undefined {
  const window = table.get(key);
  if (window && now >= window.endsAt) {
    table.delete(key);
    return undefined;
  }
  return window;
}

// The window opens with the first attempt. The attempt that reaches the limit restarts it, so
// once the limit is used up the lock always lasts the full window from that moment. Most keys use
// the default limit; a looser ceiling (for example per email across all addresses) passes its own.
export function reserveAttempt(
  key: string,
  now = Date.now(),
  limit = MAX_FAILED_ATTEMPTS,
): AttemptReservation {
  const table = tableFor(key);
  const existing = currentWindow(table, key, now);
  if (!existing) makeRoomFor(table, now);
  const window = existing ?? { count: 0, endsAt: now + LOCKOUT_WINDOW_MS, limit };
  // The limit a window was opened with decides for its whole life, the same value eviction uses.
  if (window.count >= window.limit) {
    return { allowed: false, retryAfterMs: window.endsAt - now };
  }

  window.count++;
  const isLastAllowed = window.count === window.limit;
  if (isLastAllowed) window.endsAt = now + LOCKOUT_WINDOW_MS;
  table.set(key, window);
  return { allowed: true, isLastAllowed };
}

// Gives back one reserved attempt, for a ceiling that should count failures only: the attempt
// is reserved before the password is compared and returned when the password turns out right.
export function refundAttempt(key: string): void {
  const table = tableFor(key);
  const window = table.get(key);
  if (!window) return;
  window.count = Math.max(0, window.count - 1);
  if (window.count === 0) table.delete(key);
}

// A correct answer gives the user a fresh count.
export function clearFailedAttempts(key: string): void {
  tableFor(key).delete(key);
}

export function resetAllFailedAttempts(): void {
  tables.clear();
}

export function trackedKeyCount(): number {
  let total = 0;
  for (const table of tables.values()) total += table.size;
  return total;
}
