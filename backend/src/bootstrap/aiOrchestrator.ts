import { chatOrchestrator, circuitBreaker } from '../services/ai/OrchestratorFactory';
import { logger } from '../utils/logger';

/**
 * Initializes the AI Orchestrator singleton and performs startup checks.
 * This should be called once in server.ts (src/index.ts) before the Apollo server starts.
 */
export async function initAIOrchestrator(): Promise<void> {
  logger.info('[bootstrap] Initializing AI Orchestrator...');

  try {
    // Reset all circuits on startup. Stale OPEN state from previous runs
    // (e.g., repeated 404s in dev) shouldn't block the first request.
    // The factory currently only has gemini.
    circuitBreaker.reset('gemini');

    // We can add more initialization logic here if needed, 
    // such as checking connectivity to providers.
    
    logger.info('[bootstrap] AI Orchestrator initialized successfully');
  } catch (error) {
    logger.error('[bootstrap] Failed to initialize AI Orchestrator', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    // We don't necessarily want to crash the server if AI is down, 
    // but in some systems, it might be a requirement.
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
