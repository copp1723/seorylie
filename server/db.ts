import { config } from 'dotenv';
// Load environment variables
config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";
import logger from "./utils/logger";

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL && typeof require !== 'undefined') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available, continue
  }
}

// Database connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // For development/testing without database
  console.warn("DATABASE_URL not set - database operations will be disabled");
  // Create a dummy client that doesn't actually connect
  const client = null;
  const db = null;
  export { db };
  export default db;
  export { client };
  export * from "../shared/schema";
  // Exit early to avoid connection attempts
  if (module.exports) module.exports = { db: null, client: null };
} else {

// Enhanced connection configuration with pooling
const connectionConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),              // Maximum connections in pool
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'), // Seconds
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10'), // Seconds
  max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || '3600'), // 1 hour connection lifetime
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined, // Log notices in dev
  debug: process.env.DB_DEBUG === 'true',
  transform: {
    undefined: null // Transform undefined values to null for database compatibility
  }
};

// Create postgres client with enhanced configuration
const client = postgres(connectionString, connectionConfig);

// Create drizzle instance with schema
const db = drizzle(client, { schema });

/**
 * Check database connection health
 */
export async function checkDatabaseConnection(): Promise<{
  isHealthy: boolean;
  version?: string;
  database?: string;
  user?: string;
  connectionCount?: number;
  error?: string;
  latency?: number;
}> {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity
    const result = await client`
      SELECT 
        version() as version,
        current_database() as database,
        current_user as user,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
    `;

    const info = result[0];
    const latency = Date.now() - startTime;

    logger.info('Database health check passed', {
      database: info.database,
      user: info.user,
      activeConnections: info.active_connections,
      latency: `${latency}ms`
    });

    return {
      isHealthy: true,
      version: info.version.split(' ')[0] + ' ' + info.version.split(' ')[1],
      database: info.database,
      user: info.user,
      connectionCount: parseInt(info.active_connections as string),
      latency
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Database health check failed', {
      error: errorMessage,
      latency: `${Date.now() - startTime}ms`
    });

    return {
      isHealthy: false,
      error: errorMessage,
      latency: Date.now() - startTime
    };
  }
}

/**
 * Test database connection with retries
 */
export async function testDatabaseConnection(maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const health = await checkDatabaseConnection();
      if (health.isHealthy) {
        logger.info('Database connection test successful', { attempt });
        return true;
      }
    } catch (error) {
      logger.warn('Database connection test failed', {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('Database connection test failed after all retries', { maxRetries });
  return false;
}

/**
 * Gracefully close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    logger.info('Closing database connections...');
    await client.end();
    logger.info('Database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get database pool statistics
 */
export function getDatabasePoolStats() {
  return {
    maxConnections: connectionConfig.max,
    idleTimeout: connectionConfig.idle_timeout,
    connectTimeout: connectionConfig.connect_timeout,
    maxLifetime: connectionConfig.max_lifetime
  };
}

// Set up graceful shutdown handlers
if (typeof process !== 'undefined') {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    
    closeDatabaseConnections()
      .then(() => {
        logger.info('Graceful shutdown completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Error during graceful shutdown', {
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      });
  };

  // Handle different shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });
}

// Export as both named and default export for compatibility
export { db };
export default db;

// Export the client for direct access if needed
export { client };

// Export all schema tables and types
export * from "../shared/schema.js";

}
