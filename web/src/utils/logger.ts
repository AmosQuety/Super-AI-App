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
  }
};

export default logger;
