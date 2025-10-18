export const Config = {
  // API Configuration
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.shared-backend.example',
  
  // Feature Toggles
  FEATURES: {
    AUTH_ENABLED: true,
    OFFLINE_MODE: true,
    DARK_MODE: true,
  },
  
  // App Constants
  CONSTANTS: {
    APP_NAME: 'Monorepo AI App',
    VERSION: '1.0.0',
    SUPPORT_EMAIL: 'support@monorepo.example',
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    USER_DATA: 'user_data',
    THEME_PREFERENCE: 'theme_preference',
  },
} as const;