/**
 * Graceful Configuration Loader
 * Ensures the server can start even with missing non-critical environment variables
 */

import logger from '../utils/logger';

interface GracefulConfig {
  // Critical for operation
  database: {
    url: string;
  };
  server: {
    port: number;
    host: string;
    environment: string;
  };
  
  // Optional services
  encryption: {
    available: boolean;
    key?: string;
  };
  email: {
    available: boolean;
    provider?: string;
    apiKey?: string;
  };
  analytics: {
    available: boolean;
    credentials?: string;
  };
  ai: {
    provider: 'openai' | 'openrouter' | 'mock';
    apiKey?: string;
  };
  auth: {
    jwtSecret: string;
    sessionSecret: string;
  };
}

export function loadGracefulConfig(): GracefulConfig {
  const env = process.env;
  const isProd = env.NODE_ENV === 'production';
  
  // Critical checks
  if (!env.DATABASE_URL) {
    logger.error('DATABASE_URL is required but not set');
    throw new Error('DATABASE_URL is required for operation');
  }
  
  // Generate secure defaults for secrets if not provided
  const generateSecret = (name: string): string => {
    if (isProd && !env[name]) {
      logger.warn(`${name} not set in production - using generated secret`);
      return require('crypto').randomBytes(32).toString('hex');
    }
    return env[name] || 'development-secret-' + name.toLowerCase();
  };
  
  const config: GracefulConfig = {
    database: {
      url: env.DATABASE_URL
    },
    server: {
      port: parseInt(env.PORT || '3000'),
      host: env.HOST || 'localhost',
      environment: env.NODE_ENV || 'development'
    },
    encryption: {
      available: !!env.ENCRYPTION_KEY,
      key: env.ENCRYPTION_KEY
    },
    email: {
      available: !!env.SENDGRID_API_KEY,
      provider: 'sendgrid',
      apiKey: env.SENDGRID_API_KEY
    },
    analytics: {
      available: !!env.GA4_CREDENTIALS_JSON,
      credentials: env.GA4_CREDENTIALS_JSON
    },
    ai: {
      provider: env.OPENAI_API_KEY ? 'openai' : 
                env.OPEN_ROUTER_API_KEY ? 'openrouter' : 
                'mock',
      apiKey: env.OPENAI_API_KEY || env.OPEN_ROUTER_API_KEY
    },
    auth: {
      jwtSecret: generateSecret('JWT_SECRET'),
      sessionSecret: generateSecret('SESSION_SECRET')
    }
  };
  
  // Log service availability
  logger.info('Service availability:', {
    encryption: config.encryption.available,
    email: config.email.available,
    analytics: config.analytics.available,
    ai: config.ai.provider !== 'mock'
  });
  
  return config;
}

// Singleton instance
let _config: GracefulConfig | null = null;

export function getGracefulConfig(): GracefulConfig {
  if (!_config) {
    _config = loadGracefulConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}