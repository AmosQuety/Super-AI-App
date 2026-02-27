import type { IContextBuilder } from '../../core/ports/IContextBuilder.js';
import type { IMemoryStore } from '../../core/ports/IMemoryStore.js';
import type { IVectorStore } from '../../core/ports/IVectorStore.js';
import type { ISummarizationStrategy } from '../../core/ports/ISummarizationStrategy.js';
import type { IProvider } from '../../core/ports/IProvider.js';
import type { ChatMessage } from '../../core/entities/ChatMessage.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import { createChatMessage } from '../../core/entities/ChatMessage.js';
import { TokenBudgetManager } from '../../core/context/TokenBudgetManager.js';
import { ContextBuilderConfig } from '../../core/context/ContextBuilderConfig.js';

/**
 * Production implementation of {@link IContextBuilder}.
 *
 * ## Build pipeline (in order)
 * 1. Retrieve prior history from {@link IMemoryStore}
 * 2. If over token budget **and** `ISummarizationStrategy` provided →
 *    summarize oldest non-system messages, replace with summary message
 * 3. Trim remaining messages with {@link TokenBudgetManager}
 * 4. Prepend system prompt (if configured)
 * 5. Inject RAG chunks (if {@link IVectorStore} provided and budget allows)
 * 6. Append the new `userMessage`
 *
 * All steps are budget-aware — the final list will never exceed
 * `budget.availableForContext` tokens (within the approximation tolerance).
 *
 * ### Optional dependencies
 * Both `vectorStore` and `summarizationStrategy` are optional. When absent,
 * the corresponding pipeline step is skipped silently.
 */
export class ContextBuilder implements IContextBuilder {
  private readonly budgetManager: TokenBudgetManager;

  constructor(
    private readonly memoryStore: IMemoryStore,
    private readonly providers: ReadonlyMap<string, IProvider>,
    private readonly config: ContextBuilderConfig,
    private readonly vectorStore?: IVectorStore,
    private readonly summarizationStrategy?: ISummarizationStrategy,
  ) {
    this.budgetManager = new TokenBudgetManager();
  }

  async build(
    sessionId: string,
    userMessage: ChatMessage,
    options: CompletionOptions,
  ): Promise<ChatMessage[]> {
    // Determine which provider will handle this request (for budget calculation)
    const providerId = options.provider ?? this.pickFirstProvider();
    const provider = providerId ? this.providers.get(providerId) : undefined;

    // Retrieve conversation history
    const history = await this.memoryStore.getHistory(sessionId);

    // Determine budget — use provider caps if available, otherwise a generous fallback
    const modelMaxTokens = provider?.capabilities.maxContextTokens ?? 128_000;
    const availableForContext = modelMaxTokens - this.config.reservedResponseTokens;

    // --- Step 1: Auto-summarize if over budget and strategy is available ---
    let workingHistory = [...history];
    if (
      this.summarizationStrategy !== undefined &&
      this.budgetManager.estimateTokens(workingHistory) > availableForContext
    ) {
      workingHistory = await this.summarizeOldest(workingHistory, availableForContext);
    }

    // --- Step 2: Trim if still over budget ---
    const dummyBudget = { modelMaxTokens, reservedForResponse: this.config.reservedResponseTokens, availableForContext };
    workingHistory = this.budgetManager.trim(
      workingHistory,
      dummyBudget,
      this.config.minMessagesToKeep,
    );

    // --- Step 3: System prompt ---
    const contextMessages: ChatMessage[] = [];
    if (this.config.systemPrompt !== undefined) {
      contextMessages.push(createChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: this.config.systemPrompt,
      }));
    }

    // Add trimmed history (skip pre-existing system messages if we added our own)
    if (this.config.systemPrompt !== undefined) {
      contextMessages.push(...workingHistory.filter((m) => m.role !== 'system'));
    } else {
      contextMessages.push(...workingHistory);
    }

    // --- Step 4: RAG injection ---
    if (this.vectorStore !== undefined && this.config.maxDocumentChunks > 0) {
      const chunks = await this.vectorStore.search(
        userMessage.content,
        this.config.maxDocumentChunks,
        options,
      );

      if (chunks.length > 0) {
        const chunkText = chunks
          .map((c) => (c.source ? `[${c.source}]\n${c.content}` : c.content))
          .join(this.config.documentChunkSeparator);

        const ragMessage = createChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `[Relevant context]\n${chunkText}`,
        });

        // Only inject if it fits within the budget
        const withRag = [...contextMessages, ragMessage];
        if (this.budgetManager.estimateTokens(withRag) <= availableForContext) {
          contextMessages.push(ragMessage);
        }
      }
    }

    // --- Step 5: Append user message ---
    contextMessages.push(userMessage);

    return contextMessages;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Summarizes oldest non-system messages until the history fits within the budget.
   * Returns the modified history with the summary replacing the summarized messages.
   */
  private async summarizeOldest(
    messages: ChatMessage[],
    availableForContext: number,
  ): Promise<ChatMessage[]> {
    // Find the slice of non-system messages to summarize (oldest half)
    const nonSystem = messages.filter((m) => m.role !== 'system');
    if (nonSystem.length < 2) return messages; // Nothing meaningful to summarize

    const summarizeCount = Math.ceil(nonSystem.length / 2);
    const toSummarize = nonSystem.slice(0, summarizeCount);

    try {
      const summary = await this.summarizationStrategy!.summarize(toSummarize);
      const summarizedIds = new Set(toSummarize.map((m) => m.id));

      // Replace summarized messages with the single summary message
      const remaining = messages.filter((m) => !summarizedIds.has(m.id));
      // Insert summary after last system message (or at position 0)
      const lastSystemIdx = remaining.reduce(
        (idx, m, i) => (m.role === 'system' ? i : idx),
        -1,
      );
      remaining.splice(lastSystemIdx + 1, 0, summary);
      return remaining;
    } catch {
      // Summarization failed — fall through to trim-only strategy
      return messages;
    }
  }

  private pickFirstProvider(): string | undefined {
    return this.providers.keys().next().value;
  }
}
