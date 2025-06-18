#!/usr/bin/env node

// Quick fix to add missing external_id column
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixTable() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Add external_id column if it doesn't exist
    await client.query(`
      ALTER TABLE seoworks_tasks 
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE
    `);
    console.log('✅ Added external_id column');
    
    // Update any existing rows to have external_id
    await client.query(`
      UPDATE seoworks_tasks 
      SET external_id = id::text 
      WHERE external_id IS NULL
    `);
    console.log('✅ Updated existing rows');
    
    // Make external_id NOT NULL for future inserts
    await client.query(`
      ALTER TABLE seoworks_tasks 
      ALTER COLUMN external_id SET NOT NULL
    `);
    console.log('✅ Made external_id required');
    
    console.log('\n✅ Table fixed successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixTable();