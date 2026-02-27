/**
 * GeminiModelSelector
 * ─────────────────────────────────────────────────────────────────────────────
 * Queries the Gemini `models.list` endpoint at startup to discover the
 * highest-ranking flash model that is available for the caller's API key
 * (i.e. not restricted to a paid tier with limit: 0).
 *
 * Ranked preference order (index 0 = most preferred):
 *   gemini-2.5-flash  →  gemini-2.0-flash  →  gemini-1.5-flash-latest  →  gemini-1.5-flash
 *
 * Results are cached for CACHE_TTL_MS (5 minutes) so the HTTP call is only
 * made once per server session under normal operation.
 *
 * Usage:
 *   const model = await GeminiModelSelector.discoverBestModel(apiKey);
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Ordered list of preferred flash model IDs.
 * We probe the live model list against this priority order and take the first
 * model that is both present in the API response AND supports generateContent.
 *
 * The SDK / API call itself is the real quota gate — listing models doesn't
 * count against generate quotas.
 */
export const RANKED_FLASH_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
] as const;

export type RankedFlashModel = (typeof RANKED_FLASH_MODELS)[number];

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  model: string;
  expiresAt: number;
}

let cache: CacheEntry | undefined;

// ── Types matching the Gemini models.list response ────────────────────────────

interface GeminiModelListItem {
  name: string;                           // e.g. "models/gemini-1.5-flash-latest"
  supportedGenerationMethods?: string[];  // e.g. ["generateContent", "countTokens"]
}

interface GeminiModelListResponse {
  models?: GeminiModelListItem[];
}

// ── Core discovery logic ──────────────────────────────────────────────────────

/**
 * Calls `GET /v1beta/models` and returns the best available flash model ID.
 *
 * @param apiKey - A Gemini API key to use for the request.
 * @returns  The best available model ID string (never throws — falls back to
 *           `gemini-1.5-flash-latest` on any network or parse error).
 */
export async function discoverBestModel(apiKey: string): Promise<string> {
  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (cache && Date.now() < cache.expiresAt) {
    return cache.model;
  }

  try {
    const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8_000), // 8-second timeout
    });

    if (!res.ok) {
      console.warn(
        `[GeminiModelSelector] models.list returned ${res.status} — using fallback model`
      );
      return cacheAndReturn('gemini-1.5-flash-latest');
    }

    const data: GeminiModelListResponse = await res.json();
    const available = new Set(
      (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))   // strip "models/" prefix
    );

    // Walk ranked list and return the first one present in the API response
    for (const candidate of RANKED_FLASH_MODELS) {
      if (available.has(candidate)) {
        console.info(
          `[GeminiModelSelector] Discovered best model: ${candidate} (from ${available.size} available)`
        );
        return cacheAndReturn(candidate);
      }
    }

    // None of our preferred models are listed — take any flash model
    const anyFlash = [...available].find((n) => n.includes('flash'));
    const chosen = anyFlash ?? 'gemini-1.5-flash-latest';
    console.warn(
      `[GeminiModelSelector] No preferred model found — chose: ${chosen}`
    );
    return cacheAndReturn(chosen);
  } catch (err) {
    console.warn(
      `[GeminiModelSelector] Discovery failed (${(err as Error).message}) — using fallback model`
    );
    return cacheAndReturn('gemini-1.5-flash-latest');
  }
}

/**
 * Returns the next best model in the ranked list after `currentModel`,
 * skipping any that are in `blocked`.
 *
 * Returns `undefined` if no candidates remain.
 */
export function nextBestModel(
  currentModel: string,
  blocked: ReadonlySet<string>
): string | undefined {
  const startIdx = RANKED_FLASH_MODELS.indexOf(currentModel as RankedFlashModel);
  const searchFrom = startIdx === -1 ? 0 : startIdx + 1;

  for (let i = searchFrom; i < RANKED_FLASH_MODELS.length; i++) {
    const candidate = RANKED_FLASH_MODELS[i];
    if (!blocked.has(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Manually invalidate the cache (e.g. after a model is found to be blocked).
 */
export function invalidateCache(): void {
  cache = undefined;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function cacheAndReturn(model: string): string {
  cache = { model, expiresAt: Date.now() + CACHE_TTL_MS };
  return model;
}
