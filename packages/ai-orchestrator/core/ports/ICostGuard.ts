import type { RequestCost } from '../telemetry/RequestCost.js';

/**
 * Middleware port for enforcing multi-tenant cost budgets.
 *
 * It is called before execution (`checkBudget`) and after execution
 * (`recordSpend`). Budget ceilings are defined per-tenant via `BudgetPolicy`.
 */
export interface ICostGuard {
  /**
   * Evaluates whether the tenant has enough remaining budget to proceed.
   * If the current period spend has reached or exceeded the limit, this
   * method throws a `BudgetExceededError`.
   *
   * @param tenantId The identifier of the tenant making the request.
   * @throws {BudgetExceededError} if the budget limit is reached.
   */
  checkBudget(tenantId: string): Promise<void>;

  /**
   * Post-execution hook to deduct the actual request cost from the
   * tenant's rolling ledger.
   *
   * @param tenantId The identifier of the tenant.
   * @param cost The computed monetary cost of the request.
   */
  recordSpend(tenantId: string, cost: RequestCost): Promise<void>;
}
