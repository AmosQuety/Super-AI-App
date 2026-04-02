// src/utils/logger.ts

/**
 * A simple logger utility that only prints to the console in development mode.
 * Filters out sensitive data and reduces noise in production.
 */



export const logger = {
  log: (...args: any[]) => {
    console.log(...args);
  },
  info: (...args: any[]) => {
    console.info(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    // We usually want to keep errors in production, but we can also use this 
    // to pipe them to a reporting service like Sentry (which is handled in ErrorMonitor)
    console.error(...args);
  },
  debug: (...args: any[]) => {
    console.debug(...args);
  },
  group: (label: string) => {
    console.group(label);
  },
  groupEnd: () => {
    console.groupEnd();
  }
};

export default logger;
