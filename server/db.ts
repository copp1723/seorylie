import { config } from "dotenv";
// Load environment variables
config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/index";
import logger from "./utils/logger";

// Database connection configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const connectionString = process.env.DATABASE_URL || 
  (isDevelopment ? "postgresql://localhost:5432/dev_db" : null);

console.log("Database configuration:", {
  hasConnectionString: !!process.env.DATABASE_URL,
  defaultUsed: !process.env.DATABASE_URL,
  environment: process.env.NODE_ENV,
  willConnect: !!connectionString,
});

// Skip database connection in production if no DATABASE_URL is set
if (!connectionString && !isDevelopment) {
  console.warn("⚠️ No DATABASE_URL provided in production - database features will be disabled");
}

// Enhanced connection configuration with pooling
const connectionConfig = {
  max: parseInt(process.env.DB_POOL_MAX || "20"),
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || "20"),
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "10"),
  max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || "3600"),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  onnotice: undefined, // Disable notices
  debug: false,
  transform: {
    undefined: null,
  },
};

// Create postgres client with enhanced configuration
const client = connectionString ? postgres(connectionString, connectionConfig) : null;

// Create drizzle instance with schema
const db = client ? drizzle(client, { schema }) : null;

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

  if (!client) {
    return {
      isHealthy: false,
      error: "Database client not initialized - no DATABASE_URL provided",
      latency: Date.now() - startTime,
    };
  }

  try {
    // Test basic connectivity
    const result =
      await client`SELECT version() as version, current_database() as database, current_user as user`;

    const info = result[0];
    const latency = Date.now() - startTime;

    logger.info("Database health check passed", {
      database: info.database,
      user: info.user,
      latency: `${latency}ms`,
    });

    return {
      isHealthy: true,
      version: info.version.split(" ")[0] + " " + info.version.split(" ")[1],
      database: info.database,
      user: info.user,
      latency,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.warn("Database health check failed", {
      error: errorMessage,
      latency: `${Date.now() - startTime}ms`,
    });

    return {
      isHealthy: false,
      error: errorMessage,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Test database connection with retries
 */
export async function testDatabaseConnection(
  maxRetries: number = 1,
): Promise<boolean> {
  try {
    const health = await checkDatabaseConnection();
    return health.isHealthy;
  } catch (error) {
    logger.warn("Database connection test failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Gracefully close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (!client) {
    logger.info("No database connections to close");
    return;
  }
  
  try {
    logger.info("Closing database connections...");
    await client.end();
    logger.info("Database connections closed successfully");
  } catch (error) {
    logger.error("Error closing database connections", {
      error: error instanceof Error ? error.message : String(error),
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
    maxLifetime: connectionConfig.max_lifetime,
  };
}

// Export as both named and default export for compatibility
export { db };
export default db;

// Export the client for direct access if needed
export { client };

// Export all schema tables and types
export * from "../shared/index";
