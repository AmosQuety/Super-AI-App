// Pure helpers for deciding whether the saved login is still usable.
// The token's expiry is read client-side only to avoid showing a signed-in app
// that the server will refuse; the server remains the authority.

// Treat a token as expired slightly early so a request never starts with one
// that will lapse in flight.
const EXPIRY_SKEW_MS = 30_000;

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Implemented by hand because atob is not guaranteed to exist on every React Native/Hermes version.
export function decodeBase64Url(input: string): string {
  let bits = 0;
  let bitCount = 0;
  let percentEncoded = '';

  for (const char of input.replace(/=+$/, '')) {
    const value = BASE64URL_ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Invalid base64url character');

    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      const byte = (bits >> bitCount) & 0xff;
      percentEncoded += `%${byte.toString(16).padStart(2, '0')}`;
    }
  }

  // decodeURIComponent turns the UTF-8 bytes back into text and throws on invalid sequences.
  return decodeURIComponent(percentEncoded);
}

function tokenExpiryMs(token: string | null): number | null {
  if (!token) return null;

  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const { exp } = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
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

// A rejection answers one request. If the stored token has changed since that request was
// sent (the user signed in again, or out), it says nothing about the current session.
export function isRejectionForCurrentSession(
  tokenSentWithRequest: string | null | undefined,
  currentToken: string | null
): boolean {
  return (tokenSentWithRequest ?? null) === currentToken;
}
