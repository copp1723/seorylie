#!/usr/bin/env tsx

import { db } from "../server/db";
import { logger } from "../server/logger";

/**
 * Migration script to update the database schema for authentication
 * This script adds missing columns and tables needed for the auth system
 */

async function migrateAuthSchema() {
  try {
    logger.info("Starting authentication schema migration...");

    // Add missing columns to dealerships table
    logger.info("Adding missing columns to dealerships table...");
    await db.execute(`
      ALTER TABLE dealerships
      ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS state VARCHAR(50),
      ADD COLUMN IF NOT EXISTS zip VARCHAR(20),
      ADD COLUMN IF NOT EXISTS website VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#000000',
      ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#ffffff',
      ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#4f46e5',
      ADD COLUMN IF NOT EXISTS font_family VARCHAR(100) DEFAULT 'Inter, system-ui, sans-serif',
      ADD COLUMN IF NOT EXISTS persona_name VARCHAR(100) DEFAULT 'Rylie',
      ADD COLUMN IF NOT EXISTS persona_tone VARCHAR(50) DEFAULT 'friendly',
      ADD COLUMN IF NOT EXISTS persona_template TEXT,
      ADD COLUMN IF NOT EXISTS welcome_message TEXT;
    `);

    // Update users table to make username optional and email required
    logger.info("Updating users table schema...");
    await db.execute(`
      ALTER TABLE users
      ALTER COLUMN username DROP NOT NULL,
      ALTER COLUMN email SET NOT NULL,
      ADD CONSTRAINT users_email_unique UNIQUE (email);
    `);

    // Create magic_link_invitations table if it doesn't exist
    logger.info("Creating magic_link_invitations table...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS magic_link_invitations (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER REFERENCES dealerships(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        token VARCHAR(255) NOT NULL UNIQUE,
        used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP,
        invited_by INTEGER REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create index for magic link invitations
    await db.execute(`
      CREATE INDEX IF NOT EXISTS invitation_dealership_idx
      ON magic_link_invitations(dealership_id);
    `);

    // Create a unique constraint on subdomain for dealerships
    logger.info("Adding unique constraint to dealerships subdomain...");
    await db.execute(`
      ALTER TABLE dealerships
      ADD CONSTRAINT dealerships_subdomain_unique UNIQUE (subdomain);
    `);

    // Update existing dealerships to have a subdomain if they don't have one
    logger.info("Setting default subdomains for existing dealerships...");
    await db.execute(`
      UPDATE dealerships
      SET subdomain = LOWER(REPLACE(name, ' ', '-'))
      WHERE subdomain IS NULL;
    `);

    logger.info("Authentication schema migration completed successfully!");
  } catch (error) {
    logger.error("Error during authentication schema migration:", error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateAuthSchema()
    .then(() => {
      logger.info("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateAuthSchema };
