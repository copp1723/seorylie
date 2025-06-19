#!/usr/bin/env node
/**
 * Apply specific migrations to create missing tables
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function applyMigrations() {
  console.log('🔄 Applying database migrations for missing tables...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Create seo_tasks table (matching seoworks_tasks structure)
    console.log('📄 Creating seo_tasks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealership_id UUID REFERENCES dealerships(id),
        task_type VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        assigned_to UUID REFERENCES users(id),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES seo_tasks(id) ON DELETE CASCADE,
        dealership_id UUID REFERENCES dealerships(id),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealership_id UUID REFERENCES dealerships(id),
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
    
    // Create activity_logs table
    console.log('📄 Creating activity_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id UUID,
        details JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
    `);
    console.log('✅ activity_logs table created\n');
    
    // Create ga4_data_streams table
    console.log('📄 Creating ga4_data_streams table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ga4_data_streams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID REFERENCES ga4_properties(id) ON DELETE CASCADE,
        stream_id VARCHAR(100) NOT NULL,
        stream_name VARCHAR(200) NOT NULL,
        stream_type VARCHAR(50) NOT NULL,
        measurement_id VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_ga4_data_streams_property ON ga4_data_streams(property_id);
    `);
    console.log('✅ ga4_data_streams table created\n');
    
    // Create ga4_service_accounts table  
    console.log('📄 Creating ga4_service_accounts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ga4_service_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_name VARCHAR(200) NOT NULL,
        client_email VARCHAR(255) UNIQUE NOT NULL,
        project_id VARCHAR(100) NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ga4_service_accounts table created\n');
    
    // Verify all tables
    console.log('🔍 Verifying tables...\n');
    
    const checkTables = [
      'seo_tasks',
      'deliverables', 
      'performance_metrics',
      'ga4_service_accounts',
      'ga4_data_streams',
      'activity_logs'
    ];
    
    for (const table of checkTables) {
      const result = await client.query(
        `SELECT COUNT(*) FROM ${table}`,
        []
      );
      
      const count = result.rows[0].count;
      console.log(`  ${table.padEnd(25)} - ✅ Created (${count} rows)`);
    }
    
    console.log('\n✅ All missing tables created successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
applyMigrations().catch(console.error);