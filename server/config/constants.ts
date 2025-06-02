/**
 * Application Constants and Configuration
 * Centralizes all hardcoded values with environment variable overrides
 */

// Server Configuration
export const SERVER_CONFIG = {
  PORT: parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '3000' : '5000'), 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // WebSocket Configuration
  WS_PORT: parseInt(process.env.WS_PORT || process.env.PORT || '3000', 10),
  WS_HOST: process.env.WS_HOST || process.env.HOST || 'localhost',
  
  // Session Configuration
  SESSION_SECRET: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
    return 'dev-session-secret-change-me';
  })(),
  SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
} as const;

// Database Configuration
export const DATABASE_CONFIG = {
  CONNECTION_STRING: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/cleanrylie',
  MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
} as const;

// Redis Configuration
export const REDIS_CONFIG = {
  URL: process.env.REDIS_URL || 'redis://localhost:6379',
  MAX_RETRIES: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
  RETRY_DELAY: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
  ENABLED: process.env.REDIS_ENABLED !== 'false',
} as const;

// AI Service Configuration
export const AI_CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OPENAI_API_KEY must be set');
    }
    return 'sk-test-key';
  })(),
  DEFAULT_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
  TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
} as const;

// WebSocket Service Configuration
export const WEBSOCKET_CONFIG = {
  HEALTH_CHECK_INTERVAL: parseInt(process.env.WS_HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
  CONNECTION_TIMEOUT: parseInt(process.env.WS_CONNECTION_TIMEOUT || '300000', 10), // 5 minutes
  CLEANUP_INTERVAL: parseInt(process.env.WS_CLEANUP_INTERVAL || '60000', 10), // 1 minute
  
  RATE_LIMIT: {
    MAX_MESSAGES: parseInt(process.env.WS_RATE_LIMIT_MESSAGES || '60', 10), // Max messages per minute
    WINDOW_MS: parseInt(process.env.WS_RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
    BLOCK_DURATION: parseInt(process.env.WS_RATE_LIMIT_BLOCK || '300000', 10), // 5 minutes
  },
  
  REDIS_RECONNECT: {
    MAX_ATTEMPTS: parseInt(process.env.WS_REDIS_MAX_ATTEMPTS || '10', 10),
    RETRY_DELAY: parseInt(process.env.WS_REDIS_RETRY_DELAY || '1000', 10),
  },
  
  MESSAGE_QUEUE: {
    MAX_SIZE: parseInt(process.env.WS_MESSAGE_QUEUE_SIZE || '100', 10), // Max queued messages per client
    TTL: parseInt(process.env.WS_MESSAGE_QUEUE_TTL || '86400', 10), // 24 hours
  },
} as const;

// Email Configuration
export const EMAIL_CONFIG = {
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@cleanrylie.com',
  FROM_NAME: process.env.FROM_NAME || 'CleanRylie',
} as const;

// SMS Configuration
export const SMS_CONFIG = {
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-jwt-secret-change-me';
  })(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
} as const;

// Monitoring Configuration
export const MONITORING_CONFIG = {
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  DATADOG_API_KEY: process.env.DATADOG_API_KEY || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  REDIS_WEBSOCKET_SCALING: process.env.FF_REDIS_WEBSOCKET_SCALING !== 'false',
  ENHANCED_LOGGING: process.env.FF_ENHANCED_LOGGING === 'true',
  EXPERIMENTAL_FEATURES: process.env.FF_EXPERIMENTAL === 'true',
  AI_COST_CONTROL: process.env.FF_AI_COST_CONTROL !== 'false',
} as const;

// Validation function to check required environment variables
export function validateRequiredEnvVars(): void {
  const requiredInProduction = [
    'SESSION_SECRET',
    'JWT_SECRET',
    'DATABASE_URL',
  ];

  if (SERVER_CONFIG.NODE_ENV === 'production') {
    for (const envVar of requiredInProduction) {
      if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set in production`);
      }
    }
  }
}

// Environment-specific defaults
export const ENV_DEFAULTS = {
  development: {
    LOG_LEVEL: 'debug',
    ENABLE_METRICS: false,
    REDIS_ENABLED: false,
  },
  test: {
    LOG_LEVEL: 'error',
    ENABLE_METRICS: false,
    REDIS_ENABLED: false,
  },
  production: {
    LOG_LEVEL: 'warn',
    ENABLE_METRICS: true,
    REDIS_ENABLED: true,
  },
} as const;

export default {
  SERVER_CONFIG,
  DATABASE_CONFIG,
  REDIS_CONFIG,
  AI_CONFIG,
  WEBSOCKET_CONFIG,
  EMAIL_CONFIG,
  SMS_CONFIG,
  SECURITY_CONFIG,
  MONITORING_CONFIG,
  FEATURE_FLAGS,
  validateRequiredEnvVars,
  ENV_DEFAULTS,
} as const;