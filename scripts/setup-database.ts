import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { sessions } from '../shared/schema';

/**
 * This script sets up the required database tables for the application
 * It specifically ensures the sessions table exists for authentication
 */
async function setupDatabase() {
  console.log('Setting up database tables...');

  try {
    // First check if sessions table exists
    console.log('Checking for sessions table...');
    
    try {
      // Try to query the sessions table to see if it exists
      await db.select().from(sessions).limit(1);
      console.log('Sessions table already exists.');
    } catch (error) {
      // If the table doesn't exist, create it
      console.log('Sessions table does not exist. Creating it...');
      
      // Create sessions table manually to ensure it exists
      const createSessionsTable = sql`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      `;
      
      await db.execute(createSessionsTable);
      console.log('Sessions table created.');
      
      // Create index on expire column
      const createSessionsIndex = sql`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)
      `;
      
      await db.execute(createSessionsIndex);
      console.log('Sessions index created.');
    }

    console.log('Database setup completed successfully.');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Database setup complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to set up database:', error);
    process.exit(1);
  });