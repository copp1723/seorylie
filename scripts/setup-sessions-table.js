// Script to create sessions table in PostgreSQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function setupSessionsTable() {
  console.log('Setting up sessions table...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Accept self-signed certificates
  });

  try {
    // Read SQL script
    const sqlScript = fs.readFileSync(
      path.resolve(__dirname, './setup-sessions-table.sql'),
      'utf8'
    );
    
    // Execute SQL script
    await pool.query(sqlScript);
    console.log('Sessions table setup complete');
  } catch (error) {
    console.error('Error setting up sessions table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupSessionsTable();