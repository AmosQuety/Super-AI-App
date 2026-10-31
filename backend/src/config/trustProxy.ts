export const MAX_TRUST_PROXY_HOPS = 5;

// How many reverse proxies sit between the internet and this server (TRUST_PROXY_HOPS). Express
// uses it to read the real client address from X-Forwarded-For. It is off by default and the
// value is deliberately strict: counting too few proxies only means every caller looks like the
// proxy (no worse than not setting it), but counting too many makes Express believe an address
// the caller wrote themselves, which defeats every per-address limit. A value that is not a whole
// number from 0 to MAX_TRUST_PROXY_HOPS stops the server at startup instead of being guessed at.
export function parseTrustProxyHops(raw: string | undefined): number | false {
  const text = (raw ?? "").trim();
  if (text === "" || text === "0") return false;

  // No leading zeros or signs: only the plain digits 1 to 5.
  const hops = Number(text);
  if (!/^[1-9]\d*$/.test(text) || hops > MAX_TRUST_PROXY_HOPS) {
    throw new Error(
      `TRUST_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUST_PROXY_HOPS} (the number of reverse proxies in front of this server), got "${text}"`,
    );
  }
  return hops;
}
