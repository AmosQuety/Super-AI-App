// src/lib/ErrorMonitor.ts
import * as Sentry from '@sentry/react';
import { logger } from '../utils/logger';

// Define a safer interface than 'any'
interface ErrorContext {
  [key: string]: unknown;
  componentStack?: string;
  userId?: string;
  workspaceId?: string;
  url?: string;
}

// Define environment variable interface
interface ViteEnv {
  VITE_SENTRY_DSN?: string;
  VITE_APP_ENV?: string;
  MODE?: string;
}

// Type-safe environment variable access
const env = import.meta.env as unknown as ViteEnv;

class ErrorMonitor {
  static isInitialized = false;

  static init() {
    const sentryDsn = env.VITE_SENTRY_DSN;
    
    if (sentryDsn && !this.isInitialized) {
      Sentry.init({
        dsn: sentryDsn,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        environment: env.VITE_APP_ENV || 'development',
      });
      this.isInitialized = true;
      logger.info('✅ Error Monitoring Initialized');
    }
  }

  static capture(error: Error, context: ErrorContext = {}) {
    const errorId = `err_${Date.now().toString(36)}`;

    // 1. Log to Console (Dev)
    if (env.MODE === 'development') {
      logger.group(`🚨 Error Captured [${errorId}]`);
      logger.error(error);
      logger.info('Context:', context);
      logger.groupEnd();
    }

    // 2. Send to Sentry (Prod)
    if (this.isInitialized) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        scope.setTag('errorId', errorId);
        Sentry.captureException(error);
      });
    }

    return errorId;
  }
}

export default ErrorMonitor;