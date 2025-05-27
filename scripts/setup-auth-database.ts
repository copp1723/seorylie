import { db } from "../server/db";
import { users, sessions } from "../shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { sql } from "drizzle-orm";

/**
 * This script ensures the required authentication tables exist in the database
 * It specifically checks and creates the sessions table needed for Replit Auth
 */
async function setupAuthDatabase() {
  try {
    console.log("Checking database connection...");
    
    // Check if sessions table exists, if not create it
    console.log("Creating authentication tables if they don't exist...");
    
    // Push the schema to the database
    // This will create the tables if they don't exist
    const result = await db.query.sessions.findFirst();
    if (!result) {
      console.log("Sessions table not found, creating it...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)
      `);
      console.log("Sessions table created successfully");
    } else {
      console.log("Sessions table already exists");
    }
    
    console.log("Authentication database setup completed successfully!");
  } catch (error) {
    console.error("Error setting up authentication database:", error);
    process.exit(1);
  }
}

// Run the setup function
setupAuthDatabase();