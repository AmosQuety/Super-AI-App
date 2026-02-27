import { AdaptiveRouter } from '../../infrastructure/routing/AdaptiveRouter';
import { createAdaptiveRouterConfig } from '../../infrastructure/routing/AdaptiveRouterConfig';
import { createRouterEntry } from '../../infrastructure/routing/RouterEntry';
import { CircuitBreaker } from '../../infrastructure/resilience/CircuitBreaker';
import { InMemoryTelemetryStore } from '../../infrastructure/telemetry/InMemoryTelemetryStore';
import { PolicyEngine } from '../../infrastructure/policy/PolicyEngine';
import { CostGuard } from '../../infrastructure/policy/CostGuard';
import { InMemoryCostLedgerStore } from '../../infrastructure/policy/InMemoryCostLedgerStore';
import { MockProvider } from '../../infrastructure/providers/MockProvider';
import { createPolicyRule } from '../../core/policy/PolicyRule';
import { PolicyViolationError, BudgetExceededError } from '../../core/policy/PolicyErrors';

describe('AdaptiveRouter', () => {
  let cb: CircuitBreaker;
  let telemetry: InMemoryTelemetryStore;
  let providerA: MockProvider;
  let providerB: MockProvider;

  beforeEach(() => {
    cb = new CircuitBreaker();
    telemetry = new InMemoryTelemetryStore();
    providerA = new MockProvider({ id: 'provider-a' });
    providerB = new MockProvider({ id: 'provider-b' });
  });

  it('routes to the cheapest provider when telemetry is empty (fallback to base costFactor)', async () => {
    const config = createAdaptiveRouterConfig([
      createRouterEntry(providerA, { costFactor: 1.0 }),
      createRouterEntry(providerB, { costFactor: 0.5 }), // cheaper
    ], telemetry);

    const router = new AdaptiveRouter(config, cb);
    const selected = await router.route({});
    
    // costFactor 0.5 scores higher than 1.0
    expect(selected.id).toBe('provider-b');
  });

  it('integrates live telemetry to alter routing decisions dynamically', async () => {
    const config = createAdaptiveRouterConfig([
      createRouterEntry(providerA, { costFactor: 1.0 }), // base score 1.0
      createRouterEntry(providerB, { costFactor: 1.0 }), // base score 1.0
    ], telemetry, { latencyWeight: 1.0, costWeight: 0 });

    const router = new AdaptiveRouter(config, cb);

    // Inject live telemetry: A is fast (100ms), B is slow (500ms)
    const snapA = telemetry.getSnapshot('provider-a');
    Object.assign(snapA, { requestCount: 1, avgLatencyMs: 100 });
    
    const snapB = telemetry.getSnapshot('provider-b');
    Object.assign(snapB, { requestCount: 1, avgLatencyMs: 500 });

    const selected = await router.route({});
    // Lower latency = higher 1/latency score
    expect(selected.id).toBe('provider-a');
  });

  it('applies policy engine redirects before routing', async () => {
    const policy = new PolicyEngine({
      rules: [
        createPolicyRule({
          id: 'redirect-rule',
          condition: { tenantTiers: ['free'] },
          action: { redirect: { provider: 'provider-b' } }
        })
      ],
      defaultAction: 'allow'
    });

    const config = createAdaptiveRouterConfig([
      createRouterEntry(providerA, { costFactor: 0.1 }), // very cheap, would normally win
      createRouterEntry(providerB, { costFactor: 1.0 }),
    ], telemetry, { policyEngine: policy });

    const router = new AdaptiveRouter(config, cb);

    // Free tier triggers the redirect rule to provider-b
    const selected = await router.route({
      tenantContext: { tenantId: 't1', tier: 'free' }
    });

    expect(selected.id).toBe('provider-b');
  });

  it('throws PolicyViolationError if denied by policy engine', async () => {
    const policy = new PolicyEngine({
      rules: [
        createPolicyRule({
          id: 'deny-rule',
          condition: { requestedModels: ['forbidden-model'] },
          action: 'deny'
        })
      ],
      defaultAction: 'allow'
    });

    const config = createAdaptiveRouterConfig(
      [createRouterEntry(providerA)],
      telemetry,
      { policyEngine: policy }
    );
    const router = new AdaptiveRouter(config, cb);

    await expect(router.route({ model: 'forbidden-model' }))
      .rejects.toThrow('deny-rule');
  });

  it('throws BudgetExceededError pre-flight if CostGuard blocks the tenant', async () => {
    const store = new InMemoryCostLedgerStore();
    const guard = new CostGuard({
      store,
      getPolicy: () => ({
        tenantId: 't1',
        maxCostPerRequest: 1,
        maxCostPerPeriod: 5,
        period: 'daily',
        currency: 'USD'
      })
    });

    // Exhaust budget immediately manually
    await store.addSpend('t1', { promptCost: 0, completionCost: 0, totalCost: 10, currency: 'USD' });

    const config = createAdaptiveRouterConfig(
      [createRouterEntry(providerA)],
      telemetry,
      { costGuard: guard }
    );
    const router = new AdaptiveRouter(config, cb);

    await expect(router.route({ tenantContext: { tenantId: 't1' } }))
      .rejects.toThrow('Budget exceeded');
  });
});
