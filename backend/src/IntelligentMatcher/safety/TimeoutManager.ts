// FILE: safety/TimeoutManager.ts
export class TimeoutManager {
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    fallback?: () => T
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (fallback) {
          resolve(fallback());
        } else {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      
      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}