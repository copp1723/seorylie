#!/usr/bin/env node
/**
 * Database Verification Script
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
    console.log(versionResult.rows[0].version + '\n');
    
    // Required tables
    const requiredTables = [
      'dealerships',
      'seo_tasks',
      'deliverables',
      'users',
      'ga4_properties',
      'performance_metrics',
      'reports'
    ];
    
    console.log('🔍 Checking required tables...\n');
    
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
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        tableInfo[table] = count;
        console.log(`✅ ${table.padEnd(20)} - ${count} rows`);
      } else {
        missingTables.push(table);
        console.log(`❌ ${table.padEnd(20)} - MISSING`);
      }
    }
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables detected!');
      console.log('Run your database migrations to create these tables.');
    }
    
    // Check GA4 connection status
    console.log('\n🔍 Checking GA4 Properties...\n');
    
    if (tableInfo.ga4_properties !== undefined) {
      const ga4Result = await client.query(`
        SELECT 
          d.name as dealership_name,
          g.property_id,
          g.connected,
          g.last_sync_at
        FROM ga4_properties g
        JOIN dealerships d ON g.dealership_id = d.id
        ORDER BY d.name
      `);
      
      if (ga4Result.rows.length > 0) {
        console.log('GA4 Properties Found:');
        ga4Result.rows.forEach(row => {
          const status = row.connected ? '✅ Connected' : '❌ Not Connected';
          const lastSync = row.last_sync_at ? new Date(row.last_sync_at).toLocaleString() : 'Never';
          console.log(`  ${row.dealership_name}: ${row.property_id} - ${status} (Last sync: ${lastSync})`);
        });
      } else {
        console.log('ℹ️  No GA4 properties configured yet.');
      }
    }
    
    // Database performance metrics
    console.log('\n📊 Database Performance Metrics:\n');
    
    // Table sizes
    const sizeResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `);
    
    console.log('Top 10 Tables by Size:');
    sizeResult.rows.forEach(row => {
      console.log(`  ${row.tablename.padEnd(25)} ${row.size}`);
    });
    
    // Active connections
    const connResult = await client.query(`
      SELECT count(*) as connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `);
    console.log(`\n🔗 Active Connections: ${connResult.rows[0].connections}`);
    
    // Database size
    const dbSizeResult = await client.query(`
      SELECT pg_database_size(current_database()) as size
    `);
    const dbSize = parseInt(dbSizeResult.rows[0].size);
    console.log(`💾 Total Database Size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n✅ Database verification complete!');
    
    if (missingTables.length === 0) {
      console.log('🎉 All required tables are present.');
    } else {
      console.log(`\n⚠️  ${missingTables.length} tables are missing.`);
      console.log('Please run migrations before proceeding.');
    }
    
  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n🔍 Check your DATABASE_URL - the host may be incorrect.');
    } else if (error.message.includes('password authentication failed')) {
      console.error('\n🔍 Check your DATABASE_URL - the credentials may be incorrect.');
    } else if (error.message.includes('SSL')) {
      console.error('\n🔍 SSL connection issue - this is common with Render databases.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the check
checkDatabase().catch(console.error);