import type { ISummarizationStrategy } from '../../core/ports/ISummarizationStrategy.js';
import type { IProvider } from '../../core/ports/IProvider.js';
import type { ChatMessage } from '../../core/entities/ChatMessage.js';
import { createChatMessage } from '../../core/entities/ChatMessage.js';

/** System prompt sent to the summarization provider. */
const SUMMARIZATION_SYSTEM_PROMPT =
  'You are a precise summarization assistant. ' +
  'Summarize the following conversation history into a single, compact paragraph. ' +
  'Preserve the most important facts, decisions, and context. ' +
  'Write in the third person. Do not include any preamble.';

/**
 * AI-powered implementation of {@link ISummarizationStrategy}.
 *
 * Delegates the summarization task to any registered {@link IProvider},
 * making the strategy completely model-agnostic. The strategy is designed
 * to be cheap: it uses a low `maxTokens` ceiling and a deterministic
 * temperature of 0.
 *
 * The returned {@link ChatMessage} uses `role: 'system'` so the context
 * builder can identify it as a summary and always preserve it during
 * subsequent trimming passes.
 */
export class ProviderSummarizationStrategy implements ISummarizationStrategy {
  /**
   * @param provider         - The provider to send the summarization request to.
   * @param maxSummaryTokens - Max tokens for the generated summary (default 256).
   */
  constructor(
    private readonly provider: IProvider,
    private readonly maxSummaryTokens: number = 256,
  ) {}

  async summarize(messages: readonly ChatMessage[]): Promise<ChatMessage> {
    const transcript = messages
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n');

    const systemMessage = createChatMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: SUMMARIZATION_SYSTEM_PROMPT,
    });
    const userMessage = createChatMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: transcript,
    });

    const response = await this.provider.complete(
      [systemMessage, userMessage],
      {
        temperature: 0,
        maxTokens: this.maxSummaryTokens,
      },
    );

    return createChatMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: `[Summary of earlier conversation]\n${response.content}`,
    });
  }
}
