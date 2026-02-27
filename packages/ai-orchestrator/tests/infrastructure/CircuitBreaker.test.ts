import { CircuitBreaker } from '../../infrastructure/resilience/CircuitBreaker';
import { CircuitOpenError } from '../../infrastructure/resilience/CircuitOpenError';
import { createCircuitBreakerConfig } from '../../infrastructure/resilience/CircuitBreakerConfig';

describe('CircuitBreaker', () => {
  function makeBreaker(overrides?: Parameters<typeof createCircuitBreakerConfig>[0]) {
    return new CircuitBreaker(createCircuitBreakerConfig(overrides));
  }

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts in CLOSED state for any unknown provider', () => {
    const cb = makeBreaker();
    expect(cb.getState('openai')).toBe('CLOSED');
  });

  // ── CLOSED → OPEN transition ───────────────────────────────────────────────

  it('remains CLOSED below the failure threshold', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    const fail = () => Promise.reject(new Error('boom'));
    await expect(cb.execute('p', fail)).rejects.toThrow('boom');
    await expect(cb.execute('p', fail)).rejects.toThrow('boom');
    expect(cb.getState('p')).toBe('CLOSED');
  });

  it('opens the circuit after hitting the failure threshold', async () => {
    const cb = makeBreaker({ failureThreshold: 2 });
    const fail = () => Promise.reject(new Error('fail'));
    await expect(cb.execute('p', fail)).rejects.toThrow();
    await expect(cb.execute('p', fail)).rejects.toThrow();
    expect(cb.getState('p')).toBe('OPEN');
  });

  // ── OPEN fast-fail ─────────────────────────────────────────────────────────

  it('fast-fails with CircuitOpenError when OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute('p', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    await expect(cb.execute('p', () => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('thrown CircuitOpenError carries the correct providerId', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute('openai', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    try {
      await cb.execute('openai', () => Promise.resolve('ok'));
    } catch (e) {
      expect(e).toBeInstanceOf(CircuitOpenError);
      expect((e as CircuitOpenError).providerId).toBe('openai');
    }
  });

  // ── OPEN → HALF_OPEN transition ────────────────────────────────────────────

  it('transitions to HALF_OPEN after cooldown elapses', async () => {
    const cb = makeBreaker({ failureThreshold: 1, cooldownMs: 1 });
    await expect(cb.execute('p', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(cb.getState('p')).toBe('HALF_OPEN');
  });

  // ── HALF_OPEN → CLOSED transition ─────────────────────────────────────────

  it('closes the circuit after enough successful probes in HALF_OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1, cooldownMs: 1, successThreshold: 2 });
    await expect(cb.execute('p', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(cb.getState('p')).toBe('HALF_OPEN');
    await cb.execute('p', () => Promise.resolve('ok'));
    await cb.execute('p', () => Promise.resolve('ok'));
    expect(cb.getState('p')).toBe('CLOSED');
  });

  // ── HALF_OPEN → OPEN re-trip ───────────────────────────────────────────────

  it('re-opens the circuit on probe failure in HALF_OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1, cooldownMs: 1, successThreshold: 2 });
    await expect(cb.execute('p', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    await expect(cb.execute('p', () => Promise.reject(new Error('probe fail')))).rejects.toThrow();
    expect(cb.getState('p')).toBe('OPEN');
  });

  // ── reset() ────────────────────────────────────────────────────────────────

  it('hard-resets an OPEN circuit to CLOSED', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute('p', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState('p')).toBe('OPEN');
    cb.reset('p');
    expect(cb.getState('p')).toBe('CLOSED');
  });

  it('allows successful execution after reset', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute('p', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    cb.reset('p');
    await expect(cb.execute('p', () => Promise.resolve('success'))).resolves.toBe('success');
  });

  // ── Circuit isolation ──────────────────────────────────────────────────────

  it('isolates circuit state per provider', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute('a', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState('a')).toBe('OPEN');
    expect(cb.getState('b')).toBe('CLOSED');
  });
});
