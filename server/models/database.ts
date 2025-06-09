/**
 * @file Database Connection and Configuration
 * @description Drizzle ORM setup with PostgreSQL connection
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Client } = pkg;
import * as schema from './schema';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'database' },
  transports: [
    new winston.transports.Console()
  ],
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rylie_seo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create PostgreSQL client
const client = new Client(dbConfig);

// Initialize Drizzle ORM
export const db = drizzle(client, { schema });

// Connection management
export const connectDB = async (): Promise<void> => {
  try {
    await client.connect();
    logger.info('Database connected successfully', {
      host: dbConfig.host,
      database: dbConfig.database,
      port: dbConfig.port
    });
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        host: dbConfig.host,
        database: dbConfig.database,
        port: dbConfig.port
      }
    });
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await client.end();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Database disconnection failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Health check function
export const checkDBHealth = async (): Promise<boolean> => {
  try {
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

// Export individual tables for use in queries
export * from './schema';

export default db;