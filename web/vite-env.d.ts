// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  // Add other environment variables here as you need them
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}