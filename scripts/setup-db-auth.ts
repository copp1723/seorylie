/**
 * This script sets up the database tables needed for authentication
 * Run with: npx tsx scripts/setup-db-auth.ts
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { logger } from '../server/logger';

async function setupAuthTables() {
  try {
    logger.info('Setting up authentication database tables...');

    // Create sessions table if it doesn't exist (for PostgreSQL session store)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire");
    `);

    logger.info('Sessions table created or verified');

    // Check if users table exists, if not create a simple one
    // Note: This is a simple check - a more robust solution would use
    // Drizzle migrations, but for simplicity we're using raw SQL
    const userTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);

    if (!userTableExists[0].exists) {
      logger.info('Creating users table...');

      // Create dealerships table first (since users reference it)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "dealerships" (
          "id" serial PRIMARY KEY,
          "name" text NOT NULL,
          "address" text,
          "city" text,
          "state" text,
          "zip" text,
          "phone" text,
          "email" text,
          "website" text,
          "created_at" timestamp DEFAULT NOW(),
          "updated_at" timestamp DEFAULT NOW()
        );
      `);

      // Create users table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" serial PRIMARY KEY,
          "username" text NOT NULL UNIQUE,
          "email" text,
          "password" text,
          "name" text,
          "role" text,
          "dealership_id" integer REFERENCES "dealerships"("id"),
          "active" integer DEFAULT 1,
          "created_at" timestamp DEFAULT NOW(),
          "updated_at" timestamp DEFAULT NOW(),
          "last_login" timestamp
        );
      `);

      logger.info('Users and dealerships tables created');
    } else {
      logger.info('Users table already exists');
    }

    // Check if we have any users, if not seed test users
    const userCount = await db.execute(sql`SELECT COUNT(*) FROM "users";`);
    if (parseInt(userCount[0].count) === 0) {
      logger.info('No users found, seeding test users...');

      // Insert test dealership
      const dealershipResult = await db.execute(sql`
        INSERT INTO "dealerships" ("name", "address", "city", "state", "zip", "phone", "email", "website")
        VALUES ('Luxury Auto Dealership', '123 Main St', 'Anytown', 'CA', '12345', '555-123-4567', 'info@luxuryauto.example', 'https://luxuryauto.example')
        RETURNING "id";
      `);

      const dealershipId = dealershipResult[0].id;

      // Insert test users
      await db.execute(sql`
        INSERT INTO "users" ("username", "password", "email", "name", "role", "dealership_id", "active")
        VALUES
          ('superadmin', 'password123', 'admin@rylie.ai', 'Super Admin', 'super_admin', NULL, 1),
          ('luxuryadmin', 'password123', 'admin@luxuryauto.example', 'Luxury Admin', 'dealership_admin', ${dealershipId}, 1),
          ('luxurysales', 'password123', 'sales@luxuryauto.example', 'Sales Representative', 'user', ${dealershipId}, 1);
      `);

      logger.info('Test users created successfully');
    } else {
      logger.info('Users already exist, skipping seed');
    }

    logger.info('Database setup completed successfully');
  } catch (error) {
    logger.error('Error setting up authentication tables:', error);
    throw error;
  }
}

// Run if this script is executed directly
if (require.main === module) {
  setupAuthTables()
    .then(() => {
      logger.info('Auth database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Auth database setup failed:', error);
      process.exit(1);
    });
}

export { setupAuthTables };