// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  readonly VITE_GRAPHQL_URL?: string;
  readonly VITE_AI_ENGINE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}