// src/utils/logger.ts

/**
 * A simple logger utility that only prints to the console in development mode.
 * Filters out sensitive data and reduces noise in production.
 */



const isDev = import.meta.env.MODE === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: any[]) => {
    // Keep errors in production for debugging
    console.error(...args);
  },
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },
  group: (label: string) => {
    if (isDev) console.group(label);
  },
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
  // Phase 4: Performance monitoring helper
  logOperationTiming: (operation: string, startMs: number, userId?: string) => {
    const duration = performance.now() - startMs;
    let anonUser = "anon";
    if (userId) {
      // Very basic hash to anonymize the user ID for logs
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = (hash << 5) - hash + userId.charCodeAt(i);
        hash |= 0;
      }
      anonUser = `u_${Math.abs(hash).toString(16)}`;
    }
    
    // In prod, this could flush to Datadog/Sentry
    if (isDev || duration > 1000) {
       console.info(`[Perf] ${operation} took ${Math.round(duration)}ms (user: ${anonUser})`);
    }
  }
};

export default logger;
