import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import logger from './utils/logger';

// Import from individual schema files to avoid circular dependency issues
import * as baseSchema from '../shared/schema';
import * as enhancedSchema from '../shared/enhanced-schema';
import * as leadSchema from '../shared/lead-management-schema';
import * as adfSchema from '../shared/adf-schema';
import * as extensionsSchema from '../shared/schema-extensions';

// Combine all schemas
const schema = {
  ...baseSchema,
  ...enhancedSchema,
  ...leadSchema,
  ...adfSchema,
  ...extensionsSchema
};

// Database connection configuration
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required but not configured');
}
const connectionString = process.env.DATABASE_URL;

// Enhanced SSL configuration for better compatibility with various environments
const isProduction = process.env.NODE_ENV === 'production';
const isSupabase = connectionString.includes('supabase.co');
const isRender = process.env.RENDER === 'true';

// Configure SSL based on environment variables
const sslConfig = process.env.NODE_ENV === 'development'
  ? false
  : { rejectUnauthorized: false };

// Create postgres client with enhanced configuration
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 20, // Increased from 10 to 20
  prepare: false,
  ssl: sslConfig,
  // Add retry configuration
  max_lifetime: 60 * 30, // 30 minutes
  transform: {
    undefined: null
  },
  // Enhanced error handling
  onnotice: (notice: any) => {
    logger.debug('PostgreSQL notice:', notice);
  },
  onconnect: () => {
    logger.info('New database connection established');
  },
  ondeactivate: (connection: any) => {
    logger.info('Database connection deactivated');
  },
  debug: process.env.NODE_ENV === 'development' ? console.log : false,
});

logger.info(`Attempting to connect to database with URL: ${connectionString}`);

// Create drizzle instance with all schema tables
const db = drizzle(client, { schema });

/**
 * Enhanced execute function with automatic retry logic
 * Provides resilient database operations with exponential backoff
 */
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await queryFn();
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      logger.warn(`Query attempt ${attempt} failed:`, err.message);

      // Check if it's a connection error or SSL error
      const isRetryableError = err.code === 'ECONNRESET' ||
                              err.code === 'ENOTFOUND' ||
                              err.code === 'ECONNREFUSED' ||
                              err.code === 'SELF_SIGNED_CERT_IN_CHAIN';

      if (isRetryableError && attempt < retries) {
        logger.info(`Attempting query retry ${attempt + 1}/${retries}...`);
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Re-throw error if max retries reached or non-retryable error
      throw error;
    }
  }

  throw new Error('Query failed after all retry attempts');
}

/**
 * Check database connection health with enhanced error handling
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await executeQuery(async () => {
      const result = await client`SELECT 1 as test`;
      logger.info('Database connection health check passed');
      return result[0]?.test === 1;
    });
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Database health check failed:', err);
    return false;
  }
}

// Test database connection on startup
(async () => {
  try {
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      logger.info('Database connection pool initialized successfully');
    } else {
      logger.error('Failed to verify database connection');
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to initialize database connection:', err);
  }
})();

// Graceful shutdown function
export async function closeDbConnections(): Promise<void> {
  try {
    await client.end();
    logger.info('Database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
}

export default db;
export { db, client };
