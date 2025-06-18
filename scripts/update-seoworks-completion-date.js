#!/usr/bin/env node

/**
 * Update SEOWerks Tasks Table - Add completion_date column
 * 
 * This script adds the completion_date column to existing seoworks_tasks table
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create pool from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('=== Updating SEOWerks Tasks Table ===\n');
  
  try {
    // Check if table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'seoworks_tasks'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table seoworks_tasks does not exist.');
      console.log('Please run: npm run setup:seoworks first');
      process.exit(1);
    }
    
    // Check if column already exists
    const columnCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'seoworks_tasks' 
        AND column_name = 'completion_date'
      )`
    );
    
    if (columnCheck.rows[0].exists) {
      console.log('✓ Column completion_date already exists');
    } else {
      // Read and run the migration
      const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', 'add_completion_date_to_seoworks.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log('Adding completion_date column...');
      await pool.query(migrationSQL);
      console.log('✅ Column added successfully!');
    }
    
    // Show current table structure
    const structure = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'seoworks_tasks'
       ORDER BY ordinal_position`
    );
    
    console.log('\nCurrent table structure:');
    console.log('========================');
    structure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
    });
    
    console.log('\n✅ Update complete!');
    console.log('\nJeff can now include completion_date in webhook requests.');
    
  } catch (error) {
    console.error('❌ Error updating table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});