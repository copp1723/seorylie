// File: /server/config/db.ts
// Purpose: Configures Drizzle ORM for PostgreSQL and Redis client for caching/queuing in the RylieSEO platform.
// Uses environment variables set in Render for connection strings.
// Deployment Note for Render: Ensure DATABASE_URL and REDIS_URL are set in Render environment variables.
// Render will load this configuration during service startup. No additional build steps needed.
// If connection issues occur, check Render logs for errors and verify connection string formats.

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { createClient } from 'redis';

// Database connection for PostgreSQL using Drizzle ORM
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined, // Required for Render-hosted databases in production
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout for establishing connection
});

// Initialize Drizzle ORM with the pool and schema
export const db = drizzle(pool, { schema });

// Test database connection on startup (optional, for debugging)
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err.stack);
    return;
  }
  console.log('PostgreSQL database connection established successfully');
  release(); // Release the client back to the pool
});

// Redis connection for caching and queuing
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379', // Fallback to localhost for dev if REDIS_URL not set
});

// Connect to Redis and handle errors
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Redis connection established successfully'));

// Ensure Redis connects on startup
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// Export for use in routes or services
export default { db, redisClient };