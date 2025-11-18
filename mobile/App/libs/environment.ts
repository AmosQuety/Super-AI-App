// libs/environment.ts - FIXED VERSION
export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  API_URL: string;
  GRAPHQL_URL: string;
  FACE_SERVICE_URL: string;
  APP_NAME: string;
  ENVIRONMENT: Environment;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  FEATURE_FLAGS: {
    enableAnalytics: boolean;
    enableCrashReporting: boolean;
    enableGraphQL: boolean;
    enableFaceRecognition: boolean;
    enableSubscriptions: boolean; // ADD THIS TO INTERFACE
  };
}

const developmentConfig: AppConfig = {
  API_URL: 'http://10.124.2.213:4001',
 
  // 192.168.137.1
  // 10.207.58.213
  GRAPHQL_URL: 'http://10.124.2.213:4001/graphql',
  FACE_SERVICE_URL: 'http://10.124.2.213:5001',

  
  APP_NAME: 'Super AI app',
  ENVIRONMENT: 'development',
  LOG_LEVEL: 'debug',
  FEATURE_FLAGS: {
    enableAnalytics: false,
    enableCrashReporting: true,
    enableGraphQL: true,
    enableFaceRecognition: true,
    enableSubscriptions: true, // NOW THIS IS VALID
  },
};

const stagingConfig: AppConfig = {
  API_URL: 'https://api-staging.example.com',
  GRAPHQL_URL: process.env.EXPO_PUBLIC_GRAPHQL_URL || 'https://api-staging.example.com/graphql',
  FACE_SERVICE_URL: process.env.EXPO_PUBLIC_FACE_SERVICE_URL || 'https://api-staging.example.com/face-service',
  APP_NAME: 'MyApp (Staging)',
  ENVIRONMENT: 'staging',
  LOG_LEVEL: 'info',
  FEATURE_FLAGS: {
    enableAnalytics: true,
    enableCrashReporting: true,
    enableGraphQL: true,
    enableFaceRecognition: true,
    enableSubscriptions: true, // NOW THIS IS VALID
  },
};

const productionConfig: AppConfig = {
  API_URL: 'https://api.example.com',
  GRAPHQL_URL: process.env.EXPO_PUBLIC_GRAPHQL_URL || 'https://api.example.com/graphql',
  FACE_SERVICE_URL: process.env.EXPO_PUBLIC_FACE_SERVICE_URL || 'https://api.example.com/face-service',
  APP_NAME: 'MyApp',
  ENVIRONMENT: 'production',
  LOG_LEVEL: 'error',
  FEATURE_FLAGS: {
    enableAnalytics: true,
    enableCrashReporting: true,
    enableGraphQL: true,
    enableFaceRecognition: false,
    enableSubscriptions: true, 
  },
};

function getEnvironment(): Environment {
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'development';
  return env as Environment;
}

export const environment = getEnvironment();

export const config: AppConfig = (() => {
  switch (environment) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    default:
      return developmentConfig;
  }
})();

// Environment variables validation
if (!config.API_URL) {
  throw new Error('API_URL is required in environment configuration');
}

console.log(`App running in ${config.ENVIRONMENT} mode`);