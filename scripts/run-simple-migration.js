#!/usr/bin/env node

/**
 * Simple Migration Runner for Alpha Test
 * Runs the chat assistant tables migration
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
  console.log('🚀 Running Alpha Test Migration...\n');
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', '002_chat_assistant_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Creating alpha test tables...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables were created
    const tables = [
      'dealerships', 'users', 'seo_requests', 'chat_conversations', 
      'chat_messages', 'ga4_report_cache', 'seoworks_tasks', 'ga4_properties'
    ];
    
    console.log('🔍 Verifying tables:');
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_name = $1`,
        [table]
      );
      
      if (result.rows[0].count > 0) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - Not found`);
      }
    }
    
    console.log('\n🎉 Alpha test database is ready!');
    console.log('\nNext steps:');
    console.log('1. npm start (to start the server)');
    console.log('2. npm run test:onboarding (to test dealership creation)');
    console.log('3. Open http://localhost:10000 (to test the UI)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
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

