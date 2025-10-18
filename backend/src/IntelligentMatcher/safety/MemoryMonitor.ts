// FILE: safety/MemoryMonitor.ts
export class MemoryMonitor {
  private readonly memoryThreshold: number;
  
  constructor(thresholdMB: number = 100) {
    this.memoryThreshold = thresholdMB;
  }
  
  isMemoryCritical(): boolean {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      return memoryUsage > this.memoryThreshold;
    }
    return false;
  }
  
  getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }
}