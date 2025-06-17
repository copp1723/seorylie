/**
 * @file Database Connection and Models
 * @description Database connectivity and basic model setup for SEORYLIE
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import { logger } from '../utils/errors';

// Database connection instance
let db: ReturnType<typeof drizzle> | null = null;
let connection: ReturnType<typeof postgres> | null = null;

/**
 * Connect to the database
 */
export async function connectDB(): Promise<void> {
  try {
    // Create connection URL
    const connectionUrl = config.IS_DEVELOPMENT || config.IS_TEST
      ? `postgresql://${config.DB_USER}:${config.DB_PASSWORD}@${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`
      : process.env.DATABASE_URL;

    if (!connectionUrl) {
      throw new Error('Database connection URL not configured');
    }

    // Create postgres connection
    connection = postgres(connectionUrl, {
      max: config.IS_TEST ? 1 : 10, // Limit connections in test environment
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Create Drizzle instance
    db = drizzle(connection);

    // Test the connection
    await connection`SELECT 1`;
    
    logger.info('Database connected successfully', {
      database: config.DB_NAME,
      host: config.DB_HOST,
      port: config.DB_PORT,
      environment: config.NODE_ENV
    });

  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      database: config.DB_NAME,
      host: config.DB_HOST,
      port: config.DB_PORT
    });
    throw error;
  }
}

/**
 * Get the database instance
 */
export function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

/**
 * Close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    if (connection) {
      await connection.end();
      connection = null;
      db = null;
      logger.info('Database connections closed successfully');
    }
  } catch (error) {
    logger.error('Error closing database connections', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return db !== null && connection !== null;
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth(): Promise<{ status: string; latency?: number }> {
  if (!connection) {
    return { status: 'disconnected' };
  }

  try {
    const start = Date.now();
    await connection`SELECT 1`;
    const latency = Date.now() - start;
    
    return { status: 'healthy', latency };
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return { status: 'unhealthy' };
  }
}

// Export database instance (can be null)
export { db };

// Default export for backward compatibility
export default {
  connectDB,
  getDB,
  closeDatabaseConnections,
  isDatabaseConnected,
  checkDatabaseHealth,
  db
};