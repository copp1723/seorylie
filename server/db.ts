import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

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
  throw new Error("DATABASE_URL environment variable is required");
}

// Create postgres client
const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export the client for direct access if needed
export { client };

// Export all schema tables and types
export * from "../shared/schema.js";

// Default export for backward compatibility
export default db;
