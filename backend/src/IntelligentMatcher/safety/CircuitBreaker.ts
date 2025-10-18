// FILE: safety/CircuitBreaker.ts
export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED'
  };
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() - this.state.lastFailure > this.resetTimeout) {
        this.state.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state.state === 'HALF_OPEN') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();
    
    if (this.state.failures >= this.failureThreshold) {
      this.state.state = 'OPEN';
    }
  }
  
  private reset(): void {
    this.state = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED'
    };
  }
  
  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}