/**
 * Defines spend ceilings for a tenant over a rolling time window.
 *
 * Enforced by {@link CostGuard} which reads this policy before and after
 * each completion request.
 */
export interface BudgetPolicy {
  /** Must match the `TenantContext.tenantId` it applies to. */
  readonly tenantId: string;
  /**
   * Maximum cost in `currency` units allowed per completion request.
   * Set to `Infinity` to disable per-request enforcement.
   */
  readonly maxCostPerRequest: number;
  /**
   * Maximum cumulative cost in `currency` units over `period`.
   * Set to `Infinity` to disable period enforcement.
   */
  readonly maxCostPerPeriod: number;
  /** Rolling window over which accumulated spend is measured. */
  readonly period: 'hourly' | 'daily' | 'monthly';
  /** ISO-4217 currency code (e.g. `'USD'`). */
  readonly currency: string;
}

/** Returns the approximate duration in milliseconds for a given budget period. */
export function periodToMs(period: BudgetPolicy['period']): number {
  switch (period) {
    case 'hourly':  return 60 * 60 * 1_000;
    case 'daily':   return 24 * 60 * 60 * 1_000;
    case 'monthly': return 30 * 24 * 60 * 60 * 1_000;
  }
}
