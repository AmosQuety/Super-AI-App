import type { ICostLedgerStore, CostLedgerEntry } from '../../core/ports/ICostLedgerStore.js';
import type { RequestCost } from '../../core/telemetry/RequestCost.js';
import { periodToMs } from '../../core/policy/BudgetPolicy.js';

export interface CostLedgerStoreConfig {
  /** @default 'hourly' */
  readonly currentPeriod: 'hourly' | 'daily' | 'monthly';
  /** @default 'USD' */
  readonly currency: string;
}

export class InMemoryCostLedgerStore implements ICostLedgerStore {
  private readonly ledgers = new Map<string, CostLedgerEntry>();
  private readonly config: CostLedgerStoreConfig;
  private readonly periodMs: number;

  constructor(config?: Partial<CostLedgerStoreConfig>) {
    this.config = { currentPeriod: 'hourly', currency: 'USD', ...config };
    this.periodMs = periodToMs(this.config.currentPeriod);
  }

  async getSpend(tenantId: string): Promise<CostLedgerEntry> {
    const entry = this.ledgers.get(tenantId);
    if (!entry) {
      return this.zeroEntry(tenantId);
    }

    // Check period expiry — reset if elapsed
    if (Date.now() - entry.windowStartMs >= this.periodMs) {
      const reset = this.zeroEntry(tenantId);
      this.ledgers.set(tenantId, reset);
      return reset;
    }

    return entry;
  }

  async addSpend(tenantId: string, cost: RequestCost): Promise<void> {
    const current = await this.getSpend(tenantId);
    this.ledgers.set(tenantId, {
      ...current,
      totalSpent: current.totalSpent + cost.totalCost,
    });
  }

  async reset(tenantId: string): Promise<void> {
    this.ledgers.set(tenantId, this.zeroEntry(tenantId));
  }

  // Used only for debugging / tests
  getAll(): readonly CostLedgerEntry[] {
    return Array.from(this.ledgers.values());
  }

  private zeroEntry(tenantId: string): CostLedgerEntry {
    return {
      tenantId,
      totalSpent: 0,
      currency: this.config.currency,
      windowStartMs: Date.now(),
    };
  }
}
