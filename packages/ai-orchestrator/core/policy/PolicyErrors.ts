/**
 * Thrown when a {@link PolicyRule} with action `'deny'` is matched.
 * Contains the rule identifier to aid in audit logging.
 */
export class PolicyViolationError extends Error {
  constructor(
    public readonly ruleId: string,
    public readonly reason: string,
  ) {
    super(`Policy violation [${ruleId}]: ${reason}`);
    this.name = 'PolicyViolationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by {@link CostGuard.checkBudget} when a tenant's accumulated spend
 * would exceed their configured {@link BudgetPolicy}.
 */
export class BudgetExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly currentSpend: number,
    public readonly limit: number,
    public readonly currency: string,
    public readonly period: string,
  ) {
    super(
      `Budget exceeded for tenant "${tenantId}": ` +
      `${currentSpend.toFixed(6)} ${currency} >= limit ${limit.toFixed(6)} ${currency} ` +
      `(${period})`,
    );
    this.name = 'BudgetExceededError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
