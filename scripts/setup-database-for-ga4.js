#!/usr/bin/env node
/**
 * Create missing tables with correct data types
 */

const { Client } = require('pg');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function createTables() {
  console.log('🔄 Creating missing tables with correct data types...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Create seo_tasks table with integer dealership_id
    console.log('📄 Creating seo_tasks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_tasks (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER REFERENCES dealerships(id),
        task_type VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        assigned_to INTEGER REFERENCES users(id),
        due_date TIMESTAMP,
        completed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_seo_tasks_dealership ON seo_tasks(dealership_id);
      CREATE INDEX IF NOT EXISTS idx_seo_tasks_status ON seo_tasks(status);
    `);
    console.log('✅ seo_tasks table created\n');
    
    // Create deliverables table
    console.log('📄 Creating deliverables table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS deliverables (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES seo_tasks(id) ON DELETE CASCADE,
        dealership_id INTEGER REFERENCES dealerships(id),
        title TEXT NOT NULL,
        description TEXT,
        type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        file_url TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_deliverables_task ON deliverables(task_id);
      CREATE INDEX IF NOT EXISTS idx_deliverables_dealership ON deliverables(dealership_id);
    `);
    console.log('✅ deliverables table created\n');
    
    // Create performance_metrics table
    console.log('📄 Creating performance_metrics table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER REFERENCES dealerships(id),
        metric_date DATE NOT NULL,
        metric_type VARCHAR(100) NOT NULL,
        metric_name VARCHAR(200) NOT NULL,
        metric_value NUMERIC,
        dimension_values JSONB DEFAULT '{}',
        source VARCHAR(50) DEFAULT 'ga4',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dealership_id, metric_date, metric_type, metric_name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_dealership_date 
        ON performance_metrics(dealership_id, metric_date);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_type 
        ON performance_metrics(metric_type);
    `);
    console.log('✅ performance_metrics table created\n');
    
    // Now let's run the simple GA4 test script
    console.log('\n🔍 Running GA4 connection test...\n');
    
    // First, let's seed a test dealership if none exists
    const dealershipCheck = await client.query('SELECT COUNT(*) FROM dealerships');
    if (dealershipCheck.rows[0].count === '0') {
      console.log('📄 Creating test dealership...');
      await client.query(`
        INSERT INTO dealerships (name, domain) 
        VALUES ('Jay Hatfield Chevrolet of Vinita', 'jayhatfieldchevroletvinita.com')
        ON CONFLICT DO NOTHING
      `);
      console.log('✅ Test dealership created\n');
    }
    
    // Update GA4 property with dealership reference
    const dealershipResult = await client.query(`
      SELECT id FROM dealerships WHERE name LIKE '%Jay Hatfield%' LIMIT 1
    `);
    
    if (dealershipResult.rows.length > 0) {
      const dealershipId = dealershipResult.rows[0].id;
      console.log(`📄 Updating GA4 property with dealership_id ${dealershipId}...`);
      
      await client.query(`
        UPDATE ga4_properties 
        SET dealership_id = $1,
            property_name = 'Jay Hatfield Chevrolet of Vinita',
            website_url = 'https://www.jayhatfieldchevroletvinita.com'
        WHERE property_id = '320759942'
      `, [dealershipId]);
      
      console.log('✅ GA4 property updated\n');
    }
    
    // Verify all tables
    console.log('🔍 Verifying all tables...\n');
    
    const tables = [
      'dealerships',
      'users',
      'seo_tasks',
      'deliverables',
      'performance_metrics',
      'ga4_properties',
      'reports'
    ];
    
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const count = result.rows[0].count;
      console.log(`  ${table.padEnd(25)} - ✅ ${count} rows`);
    }
    
    console.log('\n✅ Database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run check:ga4');
    console.log('2. Run: npm run setup:real-ga4');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run
createTables().catch(console.error);