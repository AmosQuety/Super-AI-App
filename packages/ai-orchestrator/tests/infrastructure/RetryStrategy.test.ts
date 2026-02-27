import { RetryStrategy } from '../../infrastructure/resilience/RetryStrategy';
import { createRetryConfig } from '../../infrastructure/resilience/RetryConfig';

describe('RetryStrategy', () => {
  let strategy: RetryStrategy;

  beforeEach(() => {
    strategy = new RetryStrategy();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Success on first attempt ───────────────────────────────────────────────

  it('returns the result immediately when fn succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const promise = strategy.execute(fn, createRetryConfig({ maxAttempts: 3, baseDelayMs: 0 }));
    jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ── Retry on failure ──────────────────────────────────────────────────────

  it('retries up to maxAttempts and returns result on eventual success', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('transient'));
      return Promise.resolve('ok');
    });

    const promise = strategy.execute(fn, createRetryConfig({ maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }));
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // ── Exhausts all attempts ──────────────────────────────────────────────────

  it('throws the last error after all attempts are exhausted', async () => {
    const error = new Error('persistent');
    const fn = jest.fn().mockRejectedValue(error);
    const promise = strategy.execute(fn, createRetryConfig({ maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 }));
    
    // Process the rejection and the subsequent delay
    await jest.runAllTimersAsync();
    
    await expect(promise).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // ── Non-retryable error predicate ─────────────────────────────────────────

  it('does not retry when the retryableErrors predicate returns false', async () => {
    const error = new Error('auth_error');
    const fn = jest.fn().mockRejectedValue(error);
    const config = createRetryConfig({
      maxAttempts: 3,
      baseDelayMs: 0,
      jitterFactor: 0,
      retryableErrors: (err) => !err.message.includes('auth'),
    });

    const promise = strategy.execute(fn, config);
    
    // Should fail immediately, but we might have a microtask tick
    await expect(promise).rejects.toThrow('auth_error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when the retryableErrors predicate returns true', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(() => {
      calls++;
      if (calls < 2) return Promise.reject(new Error('network_timeout'));
      return Promise.resolve('recovered');
    });
    const config = createRetryConfig({
      maxAttempts: 3,
      baseDelayMs: 0,
      jitterFactor: 0,
      retryableErrors: (err) => err.message.includes('network'),
    });
    const promise = strategy.execute(fn, config);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // ── maxAttempts: 1 means no retries ───────────────────────────────────────

  it('does not retry at all when maxAttempts is 1', async () => {
    const error = new Error('bang');
    const fn = jest.fn().mockRejectedValue(error);
    const promise = strategy.execute(fn, createRetryConfig({ maxAttempts: 1, baseDelayMs: 0, jitterFactor: 0 }));
    
    await expect(promise).rejects.toThrow('bang');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
