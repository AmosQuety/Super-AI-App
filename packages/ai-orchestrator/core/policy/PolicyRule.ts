/**
 * The condition clause of a {@link PolicyRule}.
 *
 * All specified fields are combined with AND semantics:
 * every non-undefined field must match for the condition to be satisfied.
 * An empty condition (all fields undefined) matches every request.
 */
export interface PolicyCondition {
  /**
   * Match if `tenantContext.tier` is in this list.
   * Ignored when `tenantContext` is not present in the request.
   */
  readonly tenantTiers?: readonly string[];

  /**
   * Match if `tenantContext.tenantId` is in this list.
   */
  readonly tenantIds?: readonly string[];

  /**
   * Match if `options.model` is in this list.
   * Ignored when `options.model` is not set.
   */
  readonly requestedModels?: readonly string[];

  /**
   * Match if `options.provider` is in this list.
   * Ignored when `options.provider` is not set.
   */
  readonly requestedProviders?: readonly string[];

  /**
   * Match if `options.stream === requiresStreaming`.
   * Ignored when undefined.
   */
  readonly requiresStreaming?: boolean;
}

/**
 * The action taken when a {@link PolicyRule} condition is satisfied.
 *
 * - `'allow'` — no-op; request proceeds normally.
 * - `'deny'`  — throws {@link PolicyViolationError} with the rule ID.
 * - `{ redirect }` — overrides `provider` and/or `model` before routing.
 */
export type PolicyAction =
  | 'allow'
  | 'deny'
  | { readonly redirect: { readonly provider?: string; readonly model?: string } };

/**
 * A single rule evaluated by the {@link IPolicyEngine}.
 *
 * Rules are evaluated in ascending `priority` order (lower = earlier).
 * The first matching rule wins; subsequent rules are skipped.
 */
export interface PolicyRule {
  /** Stable identifier used in logs and error messages. */
  readonly id: string;
  /** Human-readable explanation of what this rule enforces. */
  readonly description?: string;
  /** The matching clause — AND-semantics across all defined fields. */
  readonly condition: PolicyCondition;
  /** The action to apply when the condition is satisfied. */
  readonly action: PolicyAction;
  /**
   * Evaluation order. Lower values are evaluated first.
   * Rules with equal priority are evaluated in registration order.
   * @default 100
   */
  readonly priority: number;
}

/** Creates a {@link PolicyRule} with sensible defaults. */
export function createPolicyRule(
  partial: Omit<PolicyRule, 'priority'> & { priority?: number },
): PolicyRule {
  return Object.freeze({
    priority: 100,
    ...partial,
  });
}
