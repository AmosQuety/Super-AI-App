import { circuitBreaker, geminiProvider } from '../services/ai/OrchestratorFactory';
import { logger } from '../utils/logger';

/**
 * Initializes the AI Orchestrator singleton and performs startup checks.
 * This should be called once in server.ts (src/index.ts) before the Apollo server starts.
 */
export async function initAIOrchestrator(): Promise<void> {
  logger.info('[bootstrap] Initializing AI Orchestrator...');

  try {
    // 1. Reset circuits so stale errors don't block the first boot
    circuitBreaker.reset('gemini');

    // 2. Perform Auto-Discovery of models (The 'await' you needed)
    // This ensures we know which Gemini version to use (2.5, 1.5, etc.) before starting
    logger.info('[bootstrap] Checking Gemini model availability...');
    await geminiProvider.getActiveModel(); 
    
    logger.info('[bootstrap] AI Orchestrator initialized successfully');
  } catch (error) {
    logger.error('[bootstrap] Failed to initialize AI Orchestrator', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    // We log the error but allow the server to boot; 
    // the circuit breaker will handle failures during runtime.
  }
}

/**
 * Cleanup hooks for the AI Orchestrator.
 * Should be called during graceful shutdown.
 */
export async function shutdownAIOrchestrator(): Promise<void> {
  logger.info('[bootstrap] Shutting down AI Orchestrator...');
  // Currently, ChatOrchestrator doesn't have explicit shutdown methods,
  // but if we add persistent queues or open connections, they'd be closed here.
  logger.info('[bootstrap] AI Orchestrator shutdown complete');
}
