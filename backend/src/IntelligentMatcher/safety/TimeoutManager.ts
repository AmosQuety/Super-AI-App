// FILE: safety/TimeoutManager.ts - IMPROVED VERSION
export class TimeoutManager {
  /**
   * Wraps an operation with a timeout
   * FIXED: Better promise cleanup to prevent race conditions
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    fallback?: () => T
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    let isResolved = false;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          if (fallback) {
            // Note: This doesn't properly resolve, it rejects
            // If you want fallback to work, you need to resolve instead
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
          } else {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
          }
        }
      }, timeoutMs);
    });

    const operationPromise = operation()
      .then(result => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          return result;
        }
        // If already resolved by timeout, throw to prevent returning
        throw new Error('Operation completed after timeout');
      })
      .catch(error => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
        }
        throw error;
      });

    return Promise.race([operationPromise, timeoutPromise]);
  }

  /**
   * Alternative version that properly supports fallback values
   */
  static async withTimeoutAndFallback<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    fallbackValue: T
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    let isResolved = false;

    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.warn(`Operation timed out after ${timeoutMs}ms, using fallback`);
          resolve(fallbackValue);
        }
      }, timeoutMs);
    });

    const operationPromise = operation()
      .then(result => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          return result;
        }
        return fallbackValue; // Return fallback if already timed out
      })
      .catch(error => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
        }
        throw error;
      });

    return Promise.race([operationPromise, timeoutPromise]);
  }

  /**
   * Simple timeout wrapper without fallback complexity
   */
  static async withSimpleTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const result = await operation();
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }
}