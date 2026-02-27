import type { IRouter } from '../../core/ports/IRouter.js';
import type { IProvider } from '../../core/ports/IProvider.js';
import type { ICircuitBreaker } from '../../core/ports/ICircuitBreaker.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import type { PolicyDecision } from '../../core/ports/IPolicyEngine.js';
import type { AdaptiveRouterConfig } from './AdaptiveRouterConfig.js';
import { ProviderScorer } from './ProviderScorer.js';
import { ProviderError } from '../../infrastructure/providers/OpenAIProvider.js';
import type { ProviderMetrics } from '../../shared/types/ProviderMetrics.js';

export class AdaptiveRouter implements IRouter {
  private readonly config: AdaptiveRouterConfig;
  private readonly circuitBreaker: ICircuitBreaker;
  private readonly logger: NonNullable<AdaptiveRouterConfig['logger']>;
  private readonly scorer = new ProviderScorer();

  constructor(config: AdaptiveRouterConfig, circuitBreaker: ICircuitBreaker) {
    if (config.entries.length === 0) {
      throw new Error('AdaptiveRouter must be configured with at least one provider entry.');
    }
    this.config = config;
    this.circuitBreaker = circuitBreaker;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {}, child() { return this; } };
  }

  async route(messages: readonly import('../../core/entities/ChatMessage.js').ChatMessage[], options: CompletionOptions): Promise<IProvider> {
    const log = this.logger.child(options.tenantContext?.tenantId ?? 'unknown-tenant');

    // 1. Policy Evaluation
    let activeOptions = options;
    if (this.config.policyEngine) {
      const decision: PolicyDecision = this.config.policyEngine.evaluate(options);
      
      // Policy decision was allowed (implicit if no error thrown), 
      // but it might contain a redirect override
      if (decision.redirectProvider || decision.redirectModel) {
        activeOptions = {
          ...options,
          provider: decision.redirectProvider ?? options.provider,
          model: decision.redirectModel ?? options.model,
        };
        log.debug('Policy engine redirected request', { 
          ruleId: decision.matchedRuleId, 
          provider: activeOptions.provider,
          model: activeOptions.model 
        });
      }
    }

    // 2. Budget / Cost Governance Check
    if (this.config.costGuard && activeOptions.tenantContext) {
      // Throws BudgetExceededError if tenant has no budget left
      await this.config.costGuard.checkBudget(activeOptions.tenantContext.tenantId);
    }

    // 3. Dynamic Metrics Snapshot (Live Telemetry Bridge)
    // We convert the ITelemetryStore's ProviderTelemetrySnapshot into the 
    // internal ProviderMetrics shape expected by ProviderScorer
    const liveMetrics = new Map<string, ProviderMetrics>();
    const snapshots = this.config.telemetryStore.getAllSnapshots();
    
    for (const snap of snapshots) {
      liveMetrics.set(snap.providerId, {
        latencyEmaMs: snap.avgLatencyMs === 0 ? Infinity : snap.avgLatencyMs, // default if no successful calls
        errorRate: snap.requestCount === 0 ? 0 : snap.errorCount / snap.requestCount,
        quotaRemaining: Infinity, // Quota enforcement pushed to costGuard in Phase 6
        quotaWindowCalls: snap.requestCount,
        quotaWindowStartMs: 0, 
        lastUpdatedAt: Date.now(),
      });
    }

    // 4. Force Explicit Provider if requested (or redirected by policy)
    if (activeOptions.provider) {
      const entry = this.config.entries.find((e) => e.provider.id === activeOptions.provider);
      if (!entry) {
        throw new Error(`Requested (or redirected) provider "${activeOptions.provider}" is not registered in the router.`);
      }
      
      if (this.circuitBreaker.getState(entry.provider.id) === 'OPEN') {
        throw new ProviderError(
          entry.provider.id,
          `Explicitly requested provider "${entry.provider.id}" is circuit-broken (OPEN).`
        );
      }
      return entry.provider;
    }

    // 5. Normal Score-Based Routing (using live metrics)
    const scored = this.scorer.score(
      this.config.entries,
      activeOptions,
      liveMetrics,
      this.circuitBreaker,
      this.config,
    );

    if (scored.length === 0) {
      log.warn('No eligible providers found during Adaptive score resolution', {
        options: activeOptions,
      });
      throw new Error(
        'AdaptiveRouter: No eligible providers available. ' +
        'Check circuit breaker states, tool support, streaming support, and model compatibility.',
      );
    }

    const selected = scored[0].entry.provider;
    log.debug(`AdaptiveRouter selected provider "${selected.id}"`, { score: scored[0].score });
    
    return selected;
  }

  getFallbackChain(failedProviderId: string): readonly string[] {
    return this.config.failoverChain.filter((id) => id !== failedProviderId);
  }

  getProvider(id: string): IProvider | undefined {
    return this.config.entries.find((e) => e.provider.id === id)?.provider;
  }

  // Methods recordSuccess and recordFailure removed as TelemetryService handles feedback
}
