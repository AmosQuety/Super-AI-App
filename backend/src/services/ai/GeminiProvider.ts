/**
 * GeminiProvider — IProvider adapter for the @google/generative-ai SDK.
 *
 * ### Model selection (dynamic)
 * On the first call to `complete()` the provider calls `GeminiModelSelector`
 * to discover the best available flash model for the configured API key.
 * The result is cached for 5 minutes inside `GeminiModelSelector`.
 *
 * ### Quota-aware fallback (graceful 429 limit:0 handling)
 * When a model returns a 429 with "limit: 0" — meaning the free-tier quota
 * for that model is zero — the provider:
 *   1. Adds the model to `blockedModels`
 *   2. Picks the next best model from the ranked list (via `nextBestModel`)
 *   3. Retries the request once with the new model
 *   4. Does NOT re-throw a `CircuitOpenError` — the circuit breaker is NOT
 *      tripped, because quota walls are not transient failures.
 *
 * ### Key pool
 * Reads from GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY.
 * Rotates keys round-robin. Keys are also used for embedding calls.
 *
 * ### Embeddings
 * `getEmbedding()` is exposed directly for the RAG pipeline — outside the
 * chat-completion orchestration scope (per framework design).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  IProvider,
  ChatMessage,
  CompletionOptions,
  FinalResponse,
  ProviderCapabilities,
  StreamResponse,
} from "@super-ai/ai-orchestrator";
import {
  discoverBestModel,
  nextBestModel,
  invalidateCache,
  RANKED_FLASH_MODELS,
} from "./GeminiModelSelector";

// ── Key pool ──────────────────────────────────────────────────────────────────

const ALL_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter((k) => k);

let keyIndex = 0;
function nextKey(): string {
  if (ALL_KEYS.length === 0) throw new Error("No Gemini API keys configured");
  const key = ALL_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % ALL_KEYS.length;
  return key;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when an API error represents a free-tier quota wall (limit: 0).
 * These must NOT trip the circuit breaker — they are permanent quota limits,
 * not transient failures.
 */
function isQuotaWallError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  // "limit: 0" appears in the structured quota violation details
  return msg.includes("429") && msg.includes("limit: 0");
}

// ── Provider ──────────────────────────────────────────────────────────────────

let embeddingCooldownUntil = 0;

export class GeminiProvider implements IProvider {
  readonly id = "gemini";

  /**
   * `supportedModels` is kept as a live array that grows as we discover new
   * models.  The ProviderScorer only checks it when `options.model` is set,
   * so keeping it accurate prevents spurious capability-mismatch eliminations
   * when callers explicitly request a model.
   */
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: false,
    supportsSystemPrompt: true,
    maxContextTokens: 1_048_576,
    supportedModels: [...RANKED_FLASH_MODELS],
  };

  /** Resolved on first call to `complete()` via `GeminiModelSelector`. */
  private activeModel: string | undefined;

  /**
   * Models that returned a quota-wall error (limit: 0) during this session.
   * We skip these when selecting the next candidate.
   */
  private readonly blockedModels = new Set<string>();

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns the currently active model, or undefined if not yet resolved. */
  getActiveModel(): string | undefined {
    return this.activeModel;
  }

  // ── IProvider.complete ─────────────────────────────────────────────────────

  async complete(
    messages: readonly ChatMessage[],
    _options: CompletionOptions
  ): Promise<FinalResponse> {
    // Resolve the active model on first call (or after a cache invalidation)
    if (!this.activeModel) {
      const key = ALL_KEYS[0] ?? "";
      this.activeModel = await discoverBestModel(key);
    }

    return this.completeWithModel(messages, this.activeModel);
  }

  // ── IProvider.stream (not implemented at adapter layer) ────────────────────

  async *stream(
    _messages: readonly ChatMessage[],
    _options: CompletionOptions
  ): AsyncIterable<StreamResponse> {
    throw new Error("GeminiProvider: streaming not enabled in this integration.");
  }

  // ── IProvider.healthCheck ──────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const key = ALL_KEYS[0];
      if (!key) return false;
      const model = this.activeModel ?? "gemini-1.5-flash-latest";
      const genAI = new GoogleGenerativeAI(key);
      const sdkModel = genAI.getGenerativeModel({ model });
      const result = await sdkModel.generateContent("ping");
      return !!(await result.response).text();
    } catch {
      return false;
    }
  }

  // ── Embeddings (outside orchestrator scope) ────────────────────────────────

  async getEmbedding(text: string): Promise<number[]> {
    if (Date.now() < embeddingCooldownUntil) {
      throw new Error(`[GeminiProvider] Embeddings temporarily blocked due to successive provider failures. Try again in ${Math.ceil((embeddingCooldownUntil - Date.now())/1000)}s.`);
    }

    const embeddingModels = ["gemini-embedding-001", "text-embedding-004"];
    const targetDimensions = 768;

    for (let attempt = 0; attempt < Math.max(ALL_KEYS.length, 1); attempt++) {
      const key = nextKey();
      try {
        const genAI = new GoogleGenerativeAI(key);

        for (const embeddingModel of embeddingModels) {
          try {
            const model = genAI.getGenerativeModel({ model: embeddingModel });
            const result = await model.embedContent(text.replace(/\n/g, " "));
            const values = result.embedding.values;

            if (!Array.isArray(values) || values.length === 0) {
              throw new Error("Embedding response was empty");
            }

            if (values.length >= targetDimensions) {
              return values.slice(0, targetDimensions);
            }

            // Right-pad if provider returns fewer dimensions than expected by DB schema.
            return [...values, ...new Array(targetDimensions - values.length).fill(0)];
          } catch (innerError: unknown) {
            const innerMsg = (innerError as Error).message ?? "";
            const modelUnavailable =
              innerMsg.includes("404") ||
              innerMsg.includes("not found") ||
              innerMsg.includes("not supported for embedContent");

            if (modelUnavailable) {
              continue;
            }

            throw innerError;
          }
        }

        throw new Error("No supported Gemini embedding model available for this API key");
      } catch (error: unknown) {
        const msg = (error as Error).message ?? "";
        const isRateLimited =
          msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
        const isUnavailable =
          msg.includes("503") || msg.includes("500") || msg.includes("502");

        if (isRateLimited && attempt < ALL_KEYS.length - 1) continue;
        
        // If ALL keys exhausted on rate limit or 503, set a cooldown of 2 minutes site-wide
        if (isUnavailable || (isRateLimited && attempt === ALL_KEYS.length - 1)) {
           console.warn(`[GeminiProvider] Embedding API severely degraded/exhausted. Initiating 2 minute cooldown. (${msg.slice(0, 100)})`);
           embeddingCooldownUntil = Date.now() + 2 * 60 * 1000;
        }

        throw new Error(`Embedding failed: ${msg}`);
      }
    }
    throw new Error("All Gemini API keys exhausted for embedding");
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Calls the Gemini SDK with an explicit model.
   *
   * On a quota-wall 429 (limit: 0) the model is added to `blockedModels` and
   * the next best model is tried once.  All other errors are re-thrown so the
   * circuit breaker and retry strategy can handle them normally.
   */
  private async completeWithModel(
    messages: readonly ChatMessage[],
    model: string
  ): Promise<FinalResponse> {
    try {
      return await this.callSDK(messages, model);
    } catch (err: unknown) {
      if (isQuotaWallError(err)) {
        // Block this model for the session and invalidate the discovery cache
        // so the next full discovery skips it too.
        this.blockedModels.add(model);
        invalidateCache();

        const fallback = nextBestModel(model, this.blockedModels);
        if (!fallback) {
          throw new Error(
            `[GeminiProvider] All ranked models are quota-exhausted (blocked: ${[...this.blockedModels].join(", ")})`
          );
        }

        console.warn(
          `[GeminiProvider] Model "${model}" quota wall (limit: 0) — switching to "${fallback}"`
        );
        this.activeModel = fallback;
        return this.callSDK(messages, fallback);
      }

      // Not a quota wall — let the circuit breaker / retry handle it
      throw err;
    }
  }

  /** Raw SDK call — no error handling. */
  private async callSDK(
    messages: readonly ChatMessage[],
    model: string
  ): Promise<FinalResponse> {
    const key = nextKey();
    const genAI = new GoogleGenerativeAI(key);
    const sdkModel = genAI.getGenerativeModel({ model });

    // Build Gemini-compatible history (all but the last message)
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const lastMessage = messages[messages.length - 1];

    const chat = sdkModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage?.content ?? "");
    const response = await result.response;
    const text = response.text();

    return {
      id: `gemini-${Date.now()}`,
      content: text,
      model,
      provider: this.id,
      usage: {
        promptTokens:     response.usageMetadata?.promptTokenCount     ?? 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens:      response.usageMetadata?.totalTokenCount      ?? 0,
      },
      finishReason: "stop",
      createdAt: new Date().toISOString(),
    };
  }
}
