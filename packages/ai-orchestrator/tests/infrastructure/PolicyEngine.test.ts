import { PolicyEngine } from '../../infrastructure/policy/PolicyEngine';
import type { PolicyRule } from '../../core/policy/PolicyRule';
import { PolicyViolationError } from '../../core/policy/PolicyErrors';
import type { CompletionOptions } from '../../core/entities/CompletionOptions';
import { createPolicyRule } from '../../core/policy/PolicyRule';

describe('PolicyEngine', () => {
  it('returns allow when no rules match and defaultAction is allow', () => {
    const engine = new PolicyEngine({ rules: [], defaultAction: 'allow' });
    const decision = engine.evaluate({});
    expect(decision.allowed).toBe(true);
  });

  it('throws PolicyViolationError when no rules match and defaultAction is deny', () => {
    const engine = new PolicyEngine({ rules: [], defaultAction: 'deny' });
    expect(() => engine.evaluate({})).toThrow(PolicyViolationError);
  });

  it('evaluates rules in ascending priority order (first match wins)', () => {
    const rule1: PolicyRule = createPolicyRule({
      id: 'high-priority-deny',
      priority: 10,
      condition: { requestedProviders: ['openai'] },
      action: 'deny',
    });
    const rule2: PolicyRule = createPolicyRule({
      id: 'low-priority-allow',
      priority: 100,
      condition: { requestedProviders: ['openai'] },
      action: 'allow',
    });

    // Even if rule2 is passed first in the array, rule1 (priority 10) evaluates first
    const engine = new PolicyEngine({ rules: [rule2, rule1], defaultAction: 'allow' });

    expect(() => engine.evaluate({ provider: 'openai' })).toThrow(/high-priority-deny/);
  });

  it('denies requests matching a deny rule', () => {
    const rule = createPolicyRule({
      id: 'deny-gpt4',
      condition: { requestedModels: ['gpt-4'] },
      action: 'deny',
    });
    const engine = new PolicyEngine({ rules: [rule], defaultAction: 'allow' });

    expect(() => engine.evaluate({ model: 'gpt-4' })).toThrow(PolicyViolationError);
    expect(engine.evaluate({ model: 'gpt-3.5-turbo' }).allowed).toBe(true);
  });

  it('redirects requests matching a redirect rule', () => {
    const rule = createPolicyRule({
      id: 'redirect-free-tier',
      condition: { tenantTiers: ['free'] },
      action: { redirect: { provider: 'gemini', model: 'gemini-flash' } },
    });
    const engine = new PolicyEngine({ rules: [rule], defaultAction: 'allow' });

    const decision = engine.evaluate({ tenantContext: { tenantId: 't1', tier: 'free' } });
    expect(decision.allowed).toBe(true);
    expect(decision.redirectProvider).toBe('gemini');
    expect(decision.redirectModel).toBe('gemini-flash');
    expect(decision.matchedRuleId).toBe('redirect-free-tier');

    // Should not redirect pro tier
    const proDecision = engine.evaluate({ tenantContext: { tenantId: 't2', tier: 'pro' } });
    expect(proDecision.redirectProvider).toBeUndefined();
  });

  it('enforces AND semantics across condition fields', () => {
    const rule = createPolicyRule({
      id: 'strict-rule',
      condition: { tenantTiers: ['pro'], requestedProviders: ['openai'] },
      action: 'deny',
    });
    const engine = new PolicyEngine({ rules: [rule], defaultAction: 'allow' });

    // Both match -> denied
    expect(() => engine.evaluate({
      provider: 'openai',
      tenantContext: { tenantId: 't1', tier: 'pro' },
    })).toThrow();

    // Only provider matches -> allowed
    expect(engine.evaluate({
      provider: 'openai',
      tenantContext: { tenantId: 't2', tier: 'free' },
    }).allowed).toBe(true);

    // Only tier matches -> allowed
    expect(engine.evaluate({
      provider: 'anthropic',
      tenantContext: { tenantId: 't1', tier: 'pro' },
    }).allowed).toBe(true);
  });
});
