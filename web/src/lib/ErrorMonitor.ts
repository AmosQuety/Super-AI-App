// src/lib/ErrorMonitor.ts
import * as Sentry from '@sentry/react';

class ErrorMonitor {
  static isInitialized = false;

  static init() {
    if (import.meta.env.VITE_SENTRY_DSN && !this.isInitialized) {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0,
      });
      this.isInitialized = true;
      console.log('✅ Error Monitoring Initialized');
    }
  }

  static capture(error: Error, context: Record<string, any> = {}) {
    const errorId = `err_${Date.now().toString(36)}`;

    // 1. Log to Console (Dev)
    if (import.meta.env.DEV) {
      console.group(`🚨 Error Captured [${errorId}]`);
      console.error(error);
      console.info('Context:', context);
      console.groupEnd();
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