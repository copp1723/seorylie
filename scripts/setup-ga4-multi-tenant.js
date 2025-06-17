#!/usr/bin/env node

/**
 * Setup GA4 Multi-Tenant Tables
 * 
 * This script creates the necessary tables for multi-tenant GA4 integration
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
  console.log('=== Setting up GA4 Multi-Tenant Tables ===\n');
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', 'create_ga4_multi_tenant_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Creating tables...');
    await pool.query(migrationSQL);
    
    console.log('✅ GA4 multi-tenant tables created successfully!\n');
    
    // Verify the tables exist
    const tables = ['ga4_properties', 'ga4_service_account', 'ga4_report_cache', 'ga4_api_usage'];
    
    console.log('Verifying tables:');
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_name = $1`,
        [table]
      );
      
      if (result.rows[0].count > 0) {
        console.log(`✅ ${table} - Created`);
      } else {
        console.log(`❌ ${table} - Not found`);
      }
    }
    
    // Check service account
    const serviceAccount = await pool.query(
      'SELECT email FROM ga4_service_account LIMIT 1'
    );
    
    if (serviceAccount.rows.length > 0) {
      console.log(`\n✅ Service account configured: ${serviceAccount.rows[0].email}`);
    }
    
    console.log('\n=== Setup Complete ===');
    console.log('\nNext steps:');
    console.log('1. Each dealership needs to add the service account as Viewer to their GA4 property');
    console.log('2. Use the onboarding API to add GA4 properties for each dealership');
    console.log('3. Test the connection for each property');
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error.message);
    
    if (error.code === '42P07') {
      console.log('\nSome tables already exist. Checking current structure...');
      
      try {
        const tables = ['ga4_properties', 'ga4_service_account', 'ga4_report_cache', 'ga4_api_usage'];
        
        for (const table of tables) {
          const checkQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position;
          `;
          
          const result = await pool.query(checkQuery, [table]);
          if (result.rows.length > 0) {
            console.log(`\nTable ${table} columns:`, result.rows.map(r => r.column_name).join(', '));
          }
        }
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