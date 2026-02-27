import type { ICostGuard } from '../../core/ports/ICostGuard.js';
import type { ICostLedgerStore } from '../../core/ports/ICostLedgerStore.js';
import type { BudgetPolicy } from '../../core/policy/BudgetPolicy.js';
import type { RequestCost } from '../../core/telemetry/RequestCost.js';
import { BudgetExceededError } from '../../core/policy/PolicyErrors.js';

export interface CostGuardConfig {
  readonly store: ICostLedgerStore;
  /** Lookup map returning the active policy for a given tenant. */
  readonly getPolicy: (tenantId: string) => BudgetPolicy | undefined;
}

/**
 * Middleware enforcing `BudgetPolicy` ceilings on a per-tenant basis.
 */
export class CostGuard implements ICostGuard {
  constructor(private readonly config: CostGuardConfig) {}

  async checkBudget(tenantId: string): Promise<void> {
    const policy = this.config.getPolicy(tenantId);
    if (!policy) return; // No enforcement if no policy

    const entry = await this.config.store.getSpend(tenantId);

    if (entry.totalSpent >= policy.maxCostPerPeriod) {
      throw new BudgetExceededError(
        tenantId,
        entry.totalSpent,
        policy.maxCostPerPeriod,
        policy.currency,
        policy.period,
      );
    }
  }

  async recordSpend(tenantId: string, cost: RequestCost): Promise<void> {
    const policy = this.config.getPolicy(tenantId);
    if (!policy) return;

    // Reject massive single requests that bypass the period ceiling
    // The orchestration phase is already complete so this throws asynchronously,
    // which may be handled by logging or telemetry eventing higher up.
    if (cost.totalCost > policy.maxCostPerRequest) {
      throw new BudgetExceededError(
        tenantId,
        cost.totalCost,
        policy.maxCostPerRequest,
        policy.currency,
        'per-request',
      );
    }

    await this.config.store.addSpend(tenantId, cost);
  }
}
