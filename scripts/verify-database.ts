import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function verifyDatabase() {
  console.log(`${colors.blue}🗄️  PostgreSQL Database Verification${colors.reset}\n`);

  // 1. Check DATABASE_URL
  console.log(`${colors.yellow}1. Environment Check:${colors.reset}`);
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log(`${colors.red}❌${colors.reset} DATABASE_URL not set in environment`);
    console.log('\nFor local development, you can use:');
    console.log('DATABASE_URL=postgresql://postgres:password@localhost:5432/seorylie\n');
    process.exit(1);
  }

  // Parse and display connection info (hide password)
  try {
    const url = new URL(databaseUrl);
    console.log(`${colors.green}✅${colors.reset} DATABASE_URL is set`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port || '5432'}`);
    console.log(`   Database: ${url.pathname.slice(1)}`);
    console.log(`   User: ${url.username}`);
    console.log(`   SSL: ${url.searchParams.get('sslmode') || 'default'}`);
  } catch (err) {
    console.log(`${colors.red}❌${colors.reset} Invalid DATABASE_URL format`);
    process.exit(1);
  }

  // 2. Test connection
  console.log(`\n${colors.yellow}2. Connection Test:${colors.reset}`);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW() as time, version() as version');
    const latency = Date.now() - start;
    
    console.log(`${colors.green}✅${colors.reset} Connected successfully (${latency}ms)`);
    console.log(`   PostgreSQL: ${result.rows[0].version.split(',')[0]}`);
    console.log(`   Server Time: ${new Date(result.rows[0].time).toLocaleString()}`);
  } catch (err: any) {
    console.log(`${colors.red}❌${colors.reset} Connection failed: ${err.message}`);
    console.log('\nTroubleshooting:');
    console.log('1. Check if PostgreSQL is running');
    console.log('2. Verify credentials are correct');
    console.log('3. Ensure database exists');
    console.log('4. Check firewall/network settings');
    await pool.end();
    process.exit(1);
  }

  // 3. Check required tables
  console.log(`\n${colors.yellow}3. Table Verification:${colors.reset}`);
  const requiredTables = [
    'dealerships',
    'seo_tasks', 
    'deliverables',
    'users',
    'ga4_properties',
    'performance_metrics',
    'reports'
  ];

  const tablesQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name = ANY($1::text[])
  `;

  try {
    const { rows } = await pool.query(tablesQuery, [requiredTables]);
    const existingTables = rows.map(r => r.table_name);
    
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`${colors.green}✅${colors.reset} Table '${table}' exists`);
      } else {
        console.log(`${colors.red}❌${colors.reset} Table '${table}' missing`);
      }
    }

    if (existingTables.length < requiredTables.length) {
      console.log(`\n${colors.yellow}⚠️  Some tables are missing${colors.reset}`);
      console.log('Run database migrations to create missing tables');
    }
  } catch (err: any) {
    console.log(`${colors.red}❌${colors.reset} Failed to check tables: ${err.message}`);
  }

  // 4. Check row counts
  console.log(`\n${colors.yellow}4. Data Summary:${colors.reset}`);
  const countQueries = [
    { table: 'dealerships', query: 'SELECT COUNT(*) as count FROM dealerships' },
    { table: 'seo_tasks', query: 'SELECT COUNT(*) as count FROM seo_tasks' },
    { table: 'users', query: 'SELECT COUNT(*) as count FROM users' },
    { table: 'ga4_properties', query: 'SELECT COUNT(*) as count FROM ga4_properties' }
  ];

  for (const { table, query } of countQueries) {
    try {
      const { rows } = await pool.query(query);
      console.log(`   ${table}: ${rows[0].count} records`);
    } catch (err) {
      console.log(`   ${table}: ${colors.red}query failed${colors.reset}`);
    }
  }

  // 5. Check GA4 connections
  console.log(`\n${colors.yellow}5. GA4 Connections:${colors.reset}`);
  try {
    const ga4Query = `
      SELECT d.name, d.ga4_property_id, d.ga4_connected 
      FROM dealerships d 
      WHERE d.ga4_property_id IS NOT NULL
    `;
    const { rows } = await pool.query(ga4Query);
    
    if (rows.length === 0) {
      console.log(`${colors.yellow}⚠️${colors.reset} No dealerships have GA4 connected yet`);
      console.log('   Run: npm run setup:real-ga4');
    } else {
      for (const row of rows) {
        const status = row.ga4_connected ? 
          `${colors.green}✅ Connected${colors.reset}` : 
          `${colors.yellow}⚠️  Configured${colors.reset}`;
        console.log(`   ${row.name}: ${row.ga4_property_id} - ${status}`);
      }
    }
  } catch (err) {
    console.log(`${colors.red}❌${colors.reset} Failed to check GA4 connections`);
  }

  // 6. Performance check
  console.log(`\n${colors.yellow}6. Performance Check:${colors.reset}`);
  try {
    // Check connection pool
    const poolQuery = `
      SELECT count(*) as total,
             count(*) FILTER (WHERE state = 'idle') as idle,
             count(*) FILTER (WHERE state = 'active') as active
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    const { rows } = await pool.query(poolQuery);
    console.log(`   Connections: ${rows[0].total} total (${rows[0].active} active, ${rows[0].idle} idle)`);

    // Check database size
    const sizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    const sizeResult = await pool.query(sizeQuery);
    console.log(`   Database Size: ${sizeResult.rows[0].size}`);
  } catch (err) {
    console.log(`   ${colors.yellow}Performance metrics unavailable${colors.reset}`);
  }

  await pool.end();

  // Summary
  console.log(`\n${colors.blue}Summary:${colors.reset}`);
  console.log(`${colors.green}✅${colors.reset} Database connection is working`);
  console.log('\nNext steps:');
  console.log('1. Run migrations if tables are missing');
  console.log('2. Seed demo data: npm run seed:demo');
  console.log('3. Connect GA4: npm run setup:real-ga4');
}

// Run verification
verifyDatabase()
  .then(() => {
    console.log(`\n${colors.green}✅ Database verification complete!${colors.reset}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(`\n${colors.red}Fatal error:${colors.reset}`, err);
    process.exit(1);
  });