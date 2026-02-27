import type { IPolicyEngine, PolicyDecision } from '../../core/ports/IPolicyEngine.js';
import type { PolicyRule, PolicyCondition } from '../../core/policy/PolicyRule.js';
import { PolicyViolationError } from '../../core/policy/PolicyErrors.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import type { TenantContext } from '../../core/entities/TenantContext.js';

export interface PolicyEngineConfig {
  /** Ordered list of rules to evaluate. */
  readonly rules: readonly PolicyRule[];
  /** Default action if no rule matches. @default 'allow' */
  readonly defaultAction: 'allow' | 'deny';
}

/**
 * Synchronous rules engine for filtering or redirecting completion requests.
 * Evaluates rules in ascending priority order. The first matching rule wins.
 */
export class PolicyEngine implements IPolicyEngine {
  private readonly rules: readonly PolicyRule[];
  private readonly defaultAction: 'allow' | 'deny';

  constructor(config: PolicyEngineConfig) {
    // Stable sort ascending by priority
    this.rules = [...config.rules].sort((a, b) => a.priority - b.priority);
    this.defaultAction = config.defaultAction;
  }

  evaluate(options: CompletionOptions): PolicyDecision {
    for (const rule of this.rules) {
      if (this.matches(rule.condition, options, options.tenantContext)) {
        return this.applyAction(rule);
      }
    }

    // No rules matched
    if (this.defaultAction === 'deny') {
      throw new PolicyViolationError('DEFAULT_DENY', 'No matching allow rule found.');
    }
    return { allowed: true };
  }

  private matches(
    condition: PolicyCondition,
    options: CompletionOptions,
    tenantContext?: TenantContext,
  ): boolean {
    const { tenantTiers, tenantIds, requestedModels, requestedProviders, requiresStreaming } = condition;

    if (tenantTiers) {
      if (!tenantContext?.tier || !tenantTiers.includes(tenantContext.tier)) return false;
    }

    if (tenantIds) {
      if (!tenantContext?.tenantId || !tenantIds.includes(tenantContext.tenantId)) return false;
    }

    if (requestedModels) {
      if (!options.model || !requestedModels.includes(options.model)) return false;
    }

    if (requestedProviders) {
      if (!options.provider || !requestedProviders.includes(options.provider)) return false;
    }

    if (requiresStreaming !== undefined) {
      // Default to false if stream is undefined in options
      if ((options.stream ?? false) !== requiresStreaming) return false;
    }

    // All specified constraints satisfied
    return true;
  }

  private applyAction(rule: PolicyRule): PolicyDecision {
    if (rule.action === 'allow') {
      return { allowed: true, matchedRuleId: rule.id };
    }

    if (rule.action === 'deny') {
      throw new PolicyViolationError(
        rule.id,
        rule.description ?? 'Request blocked by policy rule.',
      );
    }

    // Redirect
    const { provider, model } = rule.action.redirect;
    return {
      allowed: true,
      redirectProvider: provider,
      redirectModel: model,
      matchedRuleId: rule.id,
    };
  }
}
