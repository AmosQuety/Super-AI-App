import type { ChatMessage } from '../entities/ChatMessage.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';
import type { IProvider } from '../ports/IProvider.js';
import { TokenBudget, createTokenBudget } from './TokenBudget.js';

/** Average chars per token (conservative, model-agnostic estimate). */
const CHARS_PER_TOKEN = 4;

/**
 * Stateless utility for token budget computation and message-window management.
 *
 * ## Design
 * - No external tokenizer dependency — uses a `chars/4` approximation.
 *   Exact tokenization would require provider-specific SDKs, which the core
 *   layer must not import. The slight over-estimate is intentional: it keeps
 *   prompts safely under the provider's hard limit.
 * - System-role messages are **always preserved** during trimming.
 *   Human/assistant turns are trimmed oldest-first until the budget is satisfied.
 * - Trimming never removes the final user message (the one being processed now).
 */
export class TokenBudgetManager {
  // ── Token estimation ──────────────────────────────────────────────────────

  /**
   * Estimates the combined token count for a list of messages.
   * Includes a small per-message overhead for role + formatting tokens.
   */
  estimateTokens(messages: readonly ChatMessage[]): number {
    return messages.reduce((total, msg) => {
      const contentTokens = Math.ceil(msg.content.length / CHARS_PER_TOKEN);
      const overhead = 4; // role token + formatting
      return total + contentTokens + overhead;
    }, 0);
  }

  /**
   * Estimates the token count for a single string (e.g. a RAG chunk).
   */
  estimateStringTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN) + 4;
  }

  // ── Budget construction ───────────────────────────────────────────────────

  /**
   * Constructs a {@link TokenBudget} from provider capabilities and call options.
   *
   * @param provider                - The target provider (supplies `maxContextTokens`).
   * @param options                 - Completion options (`maxTokens` optionally overrides reserved tokens).
   * @param reservedResponseTokens  - Fallback reserved token count if not specified in options.
   */
  buildBudget(
    provider: IProvider,
    options: CompletionOptions,
    reservedResponseTokens: number = 512,
  ): TokenBudget {
    const modelMax = provider.capabilities.maxContextTokens;
    const reserved = options.maxTokens ?? reservedResponseTokens;
    return createTokenBudget(modelMax, reserved);
  }

  // ── Budget checks ─────────────────────────────────────────────────────────

  /**
   * Returns `true` if the estimated token count exceeds the available budget.
   */
  isOverBudget(messages: readonly ChatMessage[], budget: TokenBudget): boolean {
    return this.estimateTokens(messages) > budget.availableForContext;
  }

  // ── Trimming ──────────────────────────────────────────────────────────────

  /**
   * Returns a new message array trimmed to fit within `budget.availableForContext`.
   *
   * ## Trimming policy
   * 1. System messages are **always** kept at their original positions.
   * 2. Non-system messages are candidates for removal.
   * 3. Candidates are removed oldest-first until the budget is satisfied.
   * 4. The most-recent message (last in the list) is **never** removed.
   * 5. If `minMessagesToKeep` is provided, trimming stops when that floor is reached.
   *
   * @param messages          - Ordered message history (oldest first).
   * @param budget            - Target token budget.
   * @param minMessagesToKeep - Minimum candidates to retain regardless of budget.
   */
  trim(
    messages: readonly ChatMessage[],
    budget: TokenBudget,
    minMessagesToKeep: number = 2,
  ): ChatMessage[] {
    if (!this.isOverBudget(messages, budget)) {
      return [...messages];
    }

    // Separate system messages (always kept) from trimmable ones
    const systemMessages = messages.filter((m) => m.role === 'system');
    const candidates = messages.filter((m) => m.role !== 'system');

    // Keep at least `minMessagesToKeep` candidates — slice from the end
    const floor = Math.min(minMessagesToKeep, candidates.length);

    // Try progressively larger removals from the front
    for (let removeCount = 1; removeCount <= candidates.length - floor; removeCount++) {
      const trimmedCandidates = candidates.slice(removeCount);
      const merged = this.mergeWithSystemMessages(messages, systemMessages, trimmedCandidates);

      if (!this.isOverBudget(merged, budget)) {
        return merged;
      }
    }

    // Budget still exceeded — return floor slice (best effort)
    const trimmedCandidates = candidates.slice(candidates.length - floor);
    return this.mergeWithSystemMessages(messages, systemMessages, trimmedCandidates);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Rebuilds the message array, re-inserting system messages at their original
   * relative positions among the surviving non-system messages.
   *
   * Strategy: system messages retain absolute ordering; surviving candidates
   * are interspersed in the remaining positions to preserve chronological order.
   */
  private mergeWithSystemMessages(
    original: readonly ChatMessage[],
    systemMessages: readonly ChatMessage[],
    survivingCandidates: readonly ChatMessage[],
  ): ChatMessage[] {
    const survivingIds = new Set(survivingCandidates.map((m) => m.id));
    const systemIds = new Set(systemMessages.map((m) => m.id));

    // Walk the original order and include only messages that survive
    return original.filter(
      (m) => systemIds.has(m.id) || survivingIds.has(m.id),
    );
  }
}
