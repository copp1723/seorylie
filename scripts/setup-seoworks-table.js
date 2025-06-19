#!/usr/bin/env node

/**
 * Setup SEOWerks Tasks Table
 * 
 * This script creates the seoworks_tasks table in the database
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
  console.log('=== Setting up SEOWerks Tasks Table ===\n');
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', 'create_seoworks_tasks.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ SEOWerks tasks table created successfully!\n');
    
    // Verify the table exists
    const checkQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'seoworks_tasks'
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(checkQuery);
    
    console.log('Table structure:');
    console.log('================');
    result.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up table:', error.message);
    
    if (error.code === '42P07') {
      console.log('\nTable already exists. Checking current structure...');
      
      try {
        const checkQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'seoworks_tasks'
          ORDER BY ordinal_position;
        `;
        
        const result = await pool.query(checkQuery);
        console.log('\nExisting columns:', result.rows.map(r => r.column_name).join(', '));
      } catch (checkError) {
        console.error('Error checking table structure:', checkError.message);
      }
    }
    
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