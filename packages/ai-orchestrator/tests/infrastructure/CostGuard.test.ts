import { CostGuard } from '../../infrastructure/policy/CostGuard';
import { InMemoryCostLedgerStore } from '../../infrastructure/policy/InMemoryCostLedgerStore';
import type { BudgetPolicy } from '../../core/policy/BudgetPolicy';
import { BudgetExceededError } from '../../core/policy/PolicyErrors';

describe('CostGuard & Ledger', () => {
  const t1Policy: BudgetPolicy = {
    tenantId: 't1',
    maxCostPerRequest: 5.0,
    maxCostPerPeriod: 10.0,
    period: 'daily',
    currency: 'USD',
  };

  const getPolicy = (id: string) => (id === 't1' ? t1Policy : undefined);

  let store: InMemoryCostLedgerStore;
  let guard: CostGuard;

  beforeEach(() => {
    store = new InMemoryCostLedgerStore({ currentPeriod: 'daily', currency: 'USD' });
    guard = new CostGuard({ store, getPolicy });
  });

  it('allows request when tenant has no policy configured', async () => {
    // t2 has no policy
    await expect(guard.checkBudget('t2')).resolves.not.toThrow();
    await expect(guard.recordSpend('t2', { promptCost: 1, completionCost: 1, totalCost: 2, currency: 'USD' })).resolves.not.toThrow();
  });

  it('allows request when spend is below limit', async () => {
    await guard.recordSpend('t1', { promptCost: 1, completionCost: 2, totalCost: 3, currency: 'USD' });
    await expect(guard.checkBudget('t1')).resolves.not.toThrow();
  });

  it('throws BudgetExceededError when recording a spend exceeding maxCostPerRequest', async () => {
    await expect(
      guard.recordSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 5.1, currency: 'USD' }),
    ).rejects.toThrow(BudgetExceededError);
    await expect(
      guard.recordSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 5.1, currency: 'USD' }),
    ).rejects.toThrow(/per-request/);
  });

  it('throws BudgetExceededError on checkBudget if total period spend is >= limit', async () => {
    // 3 calls of $3.5 each = $10.5 total (limit is $10.0)
    await guard.recordSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 3.5, currency: 'USD' });
    await guard.recordSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 3.5, currency: 'USD' });
    await guard.recordSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 3.5, currency: 'USD' });

    await expect(guard.checkBudget('t1')).rejects.toThrow(BudgetExceededError);
    await expect(guard.checkBudget('t1')).rejects.toThrow(/daily/);
  });

  it('InMemoryCostLedgerStore returns a fresh zeroed entry after explicit reset', async () => {
    await guard.recordSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 5, currency: 'USD' });
    const before = await store.getSpend('t1');
    expect(before.totalSpent).toBe(5);

    await store.reset('t1');
    const after = await store.getSpend('t1');
    expect(after.totalSpent).toBe(0);
  });
});
