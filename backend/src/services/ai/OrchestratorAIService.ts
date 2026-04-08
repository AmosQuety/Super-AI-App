/**
 * OrchestratorAIService
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for the legacy `GeminiAIService`.
 *
 * Public surface is intentionally identical to `GeminiAIService` so that
 * every resolver using `context.geminiAIService` continues to work without
 * any modification.
 *
 * Routing decisions, retries, circuit-breaking, and telemetry are all handled
 * transparently by `ChatOrchestrator` inside `generateContent()`.
 *
 * `getEmbedding()` is proxied directly to `GeminiProvider` because embeddings
 * are outside the chat-completion orchestration scope (per framework design).
 */

import type { ChatMessage, CompletionOptions } from '@super-ai/ai-orchestrator';
import { chatOrchestrator, geminiProvider } from './OrchestratorFactory';
import { logger } from '../../utils/logger';

export class OrchestratorAIService {
  private mapContentsToMessages(
    contents: Array<{ role: string; parts: Array<{ text: string }> }>
  ): ChatMessage[] {
    return contents
      .map((entry) => {
        const text = entry.parts?.[0]?.text?.replace(/\s+/g, ' ').trim() ?? '';
        const role: ChatMessage['role'] = entry.role === 'model' ? 'assistant' : 'user';

        return {
          id: crypto.randomUUID(),
          role,
          content: text,
          createdAt: new Date().toISOString(),
        };
      })
      .filter((message) => message.content.length > 0);
  }

  // ── generateContent ────────────────────────────────────────────────────────

  /**
   * Generates a text response for `prompt` via the ChatOrchestrator pipeline.
   *
   * The orchestrator applies:
   *  - Intelligent routing (currently: Gemini Flash, priority 10)
   *  - Per-provider retry with exponential backoff
   *  - Circuit-breaking per provider
   *  - Telemetry (latency, token usage, errors) forwarded to Winston
   *
   * @throws Re-throws `AllProvidersFailedError` when all providers in the
   *   fallback chain are exhausted — callers should handle this gracefully.
   */
  async generateContent(prompt: string): Promise<string> {
    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt.trim(),
      createdAt: new Date().toISOString(),
    };

    // Model is resolved dynamically by GeminiProvider via GeminiModelSelector.
    // Do NOT pass a model hint here — that would trigger the ProviderScorer
    // capability-mismatch check before GeminiProvider can self-select.
    const options: CompletionOptions = {};

    try {
      const response = await chatOrchestrator.complete([userMessage], options);
      return response.content;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[OrchestratorAIService] generateContent failed', { message });
      throw error;
    }
  }

  async generateContentMultiTurn(
    contents: Array<{ role: string; parts: Array<{ text: string }> }>
  ): Promise<string> {
    const messages = this.mapContentsToMessages(contents);

    if (messages.length === 0) {
      throw new Error('Contents cannot be empty');
    }

    const options: CompletionOptions = {};

    try {
      const response = await chatOrchestrator.complete(messages, options);
      return response.content;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[OrchestratorAIService] generateContentMultiTurn failed', { message });
      throw error;
    }
  }

  async generateContentStream(
    contents: Array<{ role: string; parts: Array<{ text: string }> }>,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const messages = this.mapContentsToMessages(contents);

    if (messages.length === 0) {
      throw new Error('Contents cannot be empty');
    }

    const options: CompletionOptions = {};
    let fullText = '';

    try {
      const stream = await chatOrchestrator.stream(messages, options);
      for await (const chunk of stream) {
        const text = chunk.delta ?? '';
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }
      return fullText;
    } catch (error: unknown) {
      // Fallback keeps API usable even if provider streaming is unavailable.
      const fallback = await this.generateContentMultiTurn(contents);
      if (fallback) {
        onChunk(fallback);
      }
      return fallback;
    }
  }

  // ── getEmbedding ──────────────────────────────────────────────────────────

  /**
   * Generates a vector embedding for `text`.
   *
   * Delegated directly to `GeminiProvider.getEmbedding()` because the
   * embedding model (`text-embedding-004`) sits outside the chat-completion
   * orchestration path.
   */
  async getEmbedding(text: string): Promise<number[]> {
    return geminiProvider.getEmbedding(text);
  }

  // ── getKeyHealthStatus ────────────────────────────────────────────────────

  /**
   * Backward-compatible stub.
   *
   * The legacy `GeminiAIService` exposed per-key circuit-breaker states.
   * Key-level health is now surfaced through the orchestrator's telemetry
   * store. This stub returns an empty array — consuming code (if any) must
   * tolerate an empty result.
   */
  getKeyHealthStatus(): { key: number; state: string }[] {
    return [];
  }
}
