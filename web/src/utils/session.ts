// Pure helpers for deciding whether the saved login is still usable.
// The token's expiry is read client-side only to avoid showing a signed-in app
// that the server will refuse; the server remains the authority.

const PUBLIC_ROUTES = ['/', '/login', '/register'];

// Treat a token as expired slightly early so a request never starts with one
// that will lapse in flight.
const EXPIRY_SKEW_MS = 30_000;

function tokenExpiryMs(token: string | null): number | null {
  if (!token) return null;

  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const { exp } = JSON.parse(json) as { exp?: unknown };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

// A missing, malformed or expiry-less token is treated as expired (fail closed).
export function isSessionExpired(token: string | null, nowMs: number = Date.now()): boolean {
  const expiry = tokenExpiryMs(token);
  return expiry === null || expiry - EXPIRY_SKEW_MS <= nowMs;
}

export function msUntilExpiry(token: string | null, nowMs: number = Date.now()): number {
  const expiry = tokenExpiryMs(token);
  return expiry === null ? 0 : Math.max(0, expiry - nowMs);
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

export function loginRedirectUrl(pathname: string, search: string): string {
  return `/login?returnTo=${encodeURIComponent(pathname + search)}`;
}
