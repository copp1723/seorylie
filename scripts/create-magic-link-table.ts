/**
 * Script to create the magic_link_invitations table
 * Run with: npx tsx scripts/create-magic-link-table.ts
 */
import { db } from '../server/db';
import { logger } from '../server/logger';
import { magicLinkInvitations } from '@shared/schema';

async function createMagicLinkTable() {
  try {
    logger.info('Setting up magic link invitations table...');
    
    // Create the magic_link_invitations table if it doesn't exist
    const { magicLinkInvitations } = await import('@shared/schema');
    
    // This will push the schema to the database
    await db.execute(`
      CREATE TABLE IF NOT EXISTS magic_link_invitations (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        invited_by TEXT,
        dealership_id INTEGER,
        role TEXT,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_invitations(email);
      CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_invitations(token);
    `);
    
    logger.info('Magic link invitations table setup complete');
    
    return true;
  } catch (error) {
    logger.error('Error setting up magic link invitations table:', error);
    return false;
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  createMagicLinkTable()
    .then(success => {
      if (success) {
        logger.info('Magic link invitations table created successfully');
        process.exit(0);
      } else {
        logger.error('Failed to create magic link invitations table');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Unhandled error creating magic link invitations table:', error);
      process.exit(1);
    });
}

export { createMagicLinkTable };