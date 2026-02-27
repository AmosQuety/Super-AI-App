import type { CompletionOptions } from '../entities/CompletionOptions.js';

/**
 * The outcome of a {@link IPolicyEngine.evaluate} call.
 */
export interface PolicyDecision {
  /** True if the request is permitted by the policy engine. */
  readonly allowed: boolean;
  /** Set if a matching rule dictates a provider override. */
  readonly redirectProvider?: string;
  /** Set if a matching rule dictates a model override. */
  readonly redirectModel?: string;
  /** The ID of the rule that triggered this decision, for audit logging. */
  readonly matchedRuleId?: string;
}

/**
 * Evaluates routing policies (model allow-lists, tier-based routing, etc)
 * against a given set of completion options.
 *
 * Implemented by `PolicyEngine`.
 */
export interface IPolicyEngine {
  /**
   * Synchronously evaluates the configured rules against the request.
   *
   * @param options The requested completion options. Includes `tenantContext`.
   * @returns A decision indicating whether to allow, deny, or redirect the request.
   */
  evaluate(options: CompletionOptions): PolicyDecision;
}
