import { config } from 'dotenv';
// Load environment variables
config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";

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
});

// Create drizzle instance with schema
const db = drizzle(client, { schema });

// Export as both named and default export for compatibility
export { db };
export default db;

// Export the client for direct access if needed
export { client };

// Export all schema tables and types
export * from "../shared/schema.js";
