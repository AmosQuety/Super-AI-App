import type { RequestCost } from '../telemetry/RequestCost.js';

/** A snapshot of a tenant's accumulated spend within the current billing period. */
export interface CostLedgerEntry {
  readonly tenantId: string;
  /** Total monetary spend accumulated since {@link windowStartMs}. */
  readonly totalSpent: number;
  /** ISO-4217 currency code. */
  readonly currency: string;
  /** Start time of the current accumulation window. */
  readonly windowStartMs: number;
}

/**
 * Persistence port for accumulating tenant spend.
 * Underlying implementations may use Redis, SQL, or in-memory tables.
 */
export interface ICostLedgerStore {
  /**
   * Retrieves the current spend for a tenant.
   * If the tenant does not exist in the ledger, returns a zeroed entry.
   * If the configured period has rolled over, implementations should
   * return a freshly reset zeroed entry.
   */
  getSpend(tenantId: string): Promise<CostLedgerEntry>;

  /**
   * Accumulates the given cost into the tenant's current window.
   */
  addSpend(tenantId: string, cost: RequestCost): Promise<void>;

  /**
   * Explicitly resets a tenant's spend to 0 and starts a new window at `Date.now()`.
   */
  reset(tenantId: string): Promise<void>;
}
