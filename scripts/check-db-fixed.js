#!/usr/bin/env node
/**
 * Database Verification Script - Fixed Version
 * Checks PostgreSQL connection and required tables
 */

const { Client } = require('pg');

async function checkDatabase() {
  console.log('🔍 Database Verification Starting...\n');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('\nPlease set: export DATABASE_URL="your-database-url"');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL is set');
  console.log(`📍 Host: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'}\n`);
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    console.log('🔄 Testing database connection...');
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL\n');
    
    // Check PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:');
    console.log(versionResult.rows[0].version.split(' on ')[0] + '\n');
    
    // Get all tables
    console.log('📋 All tables in database:\n');
    const allTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Found tables:');
    allTablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Required tables (based on what might exist)
    const requiredTables = [
      'dealerships',
      'seo_tasks',
      'deliverables', 
      'users',
      'ga4_properties',
      'performance_metrics',
      'reports',
      'tasks',  // Alternative name
      'agent_deliverables',  // Alternative name
      'ga4_reports'  // Alternative name
    ];
    
    console.log('\n🔍 Checking for required/expected tables...\n');
    
    const missingTables = [];
    const tableInfo = {};
    
    for (const table of requiredTables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      const exists = result.rows[0].exists;
      
      if (exists) {
        // Get row count
        try {
          const countResult = await client.query(`SELECT COUNT(*) FROM "${table}"`);
          const count = parseInt(countResult.rows[0].count);
          tableInfo[table] = count;
          console.log(`✅ ${table.padEnd(25)} - ${count} rows`);
        } catch (e) {
          console.log(`⚠️  ${table.padEnd(25)} - Error counting rows`);
        }
      } else {
        missingTables.push(table);
        console.log(`❌ ${table.padEnd(25)} - Not found`);
      }
    }
    
    // Check GA4 connection status with proper column types
    console.log('\n🔍 Checking GA4 Properties...\n');
    
    // First, let's see the structure of ga4_properties
    if (tableInfo.ga4_properties !== undefined) {
      try {
        // Get column info
        const columnsResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'ga4_properties'
          ORDER BY ordinal_position
        `);
        
        console.log('GA4 Properties table structure:');
        columnsResult.rows.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type}`);
        });
        
        // Get GA4 data with safer query
        const ga4Result = await client.query(`
          SELECT * FROM ga4_properties LIMIT 5
        `);
        
        console.log(`\nGA4 Properties (${ga4Result.rows.length} records):`);
        ga4Result.rows.forEach(row => {
          console.log(`  Property ID: ${row.property_id || row.ga4_property_id}`);
          console.log(`  Connected: ${row.connected || row.is_connected || 'N/A'}`);
          console.log(`  Last Sync: ${row.last_sync_at || row.last_synced_at || 'Never'}`);
          console.log('  ---');
        });
      } catch (e) {
        console.log('Error querying GA4 properties:', e.message);
      }
    }
    
    // Database performance metrics
    console.log('\n📊 Database Performance Metrics:\n');
    
    try {
      // Table sizes
      const sizeResult = await client.query(`
        SELECT 
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);
      
      console.log('Top Tables by Size:');
      sizeResult.rows.forEach(row => {
        console.log(`  ${row.tablename.padEnd(25)} ${row.size}`);
      });
    } catch (e) {
      console.log('Could not get table sizes');
    }
    
    // Database info
    try {
      const dbInfoResult = await client.query(`
        SELECT 
          current_database() as database,
          pg_database_size(current_database()) as size,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
      `);
      
      const info = dbInfoResult.rows[0];
      console.log(`\n📊 Database Info:`);
      console.log(`  Name: ${info.database}`);
      console.log(`  Size: ${(parseInt(info.size) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Active Connections: ${info.active_connections}`);
    } catch (e) {
      console.log('Could not get database info');
    }
    
    console.log('\n✅ Database verification complete!');
    
  } catch (error) {
    console.error('\n❌ Database error!');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the check
checkDatabase().catch(console.error);