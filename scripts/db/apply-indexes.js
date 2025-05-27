/**
 * Database Index Application Script
 * 
 * This script applies strategic indexes to improve database performance.
 * Run with: node scripts/db/apply-indexes.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Get database connection details from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'apply-indexes.sql');
const sqlCommands = fs.readFileSync(sqlFilePath, 'utf8');

async function applyIndexes() {
  const client = await pool.connect();
  
  try {
    console.log('Starting index application...');
    
    // Execute SQL commands
    await client.query(sqlCommands);
    
    console.log('Indexes applied successfully!');
    
    // Query index information
    const { rows } = await client.query(`
      SELECT 
        schemaname, 
        tablename, 
        indexname, 
        indexdef
      FROM 
        pg_indexes 
      WHERE 
        schemaname = 'public'
      ORDER BY 
        tablename, 
        indexname
    `);
    
    // Display index information
    console.log('\nApplied Indexes:');
    console.log('----------------');
    
    let currentTable = '';
    rows.forEach(row => {
      if (row.tablename !== currentTable) {
        currentTable = row.tablename;
        console.log(`\nTable: ${currentTable}`);
      }
      console.log(`  - ${row.indexname}: ${row.indexdef}`);
    });
    
    console.log('\nPerformance improvement complete!');
    console.log('Database queries should now be significantly faster.');
    
  } catch (error) {
    console.error('Error applying indexes:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
applyIndexes().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});