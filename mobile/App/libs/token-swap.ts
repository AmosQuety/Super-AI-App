export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
}

export type TokenSwapResult = 'stored' | 'session_changed' | 'storage_failed';

// After a request that revoked the token in use, the server returns a fresh one. It may be stored
// only if this device still holds the token the request started with: if the user signed out (or
// the session was rejected) while the request ran, writing it back would restore a session the
// user believes is over. The check and the write are two storage calls, so a sign-out landing
// between them is not covered; that window is a few milliseconds.
export async function replaceTokenIfSessionUnchanged(
  tokenBeforeRequest: string | null,
  freshToken: string,
  store: TokenStore
): Promise<TokenSwapResult> {
  const tokenNow = await store.get();
  if (tokenNow === null || tokenNow !== tokenBeforeRequest) return 'session_changed';

  try {
    await store.set(freshToken);
    return 'stored';
  } catch {
    return 'storage_failed';
  }
}

// After the server has revoked this device's token, only a failed write leaves the user without a
// session they have been told about; the screens use this to say so instead of reporting plain
// success.
export function mustSignInAgain(result: TokenSwapResult | undefined): boolean {
  return result === 'storage_failed';
}
