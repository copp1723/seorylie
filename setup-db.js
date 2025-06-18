#!/usr/bin/env node

// Simple database setup script for production
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create SEOWerks tasks table
    console.log('\n=== Creating SEOWerks Tasks Table ===');
    await client.query(`
      CREATE TABLE IF NOT EXISTS seoworks_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        task_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        data JSONB,
        completion_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ seoworks_tasks table created');

    // Create GA4 multi-tenant tables
    console.log('\n=== Creating GA4 Multi-Tenant Tables ===');
    
    // GA4 Properties table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ga4_properties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealership_id UUID NOT NULL,
        property_id VARCHAR(32) NOT NULL,
        property_name TEXT,
        measurement_id VARCHAR(30),
        website_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sync_status VARCHAR(20) DEFAULT 'pending',
        last_sync_at TIMESTAMP,
        last_sync_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dealership_id, property_id)
      );
    `);
    console.log('✅ ga4_properties table created');

    // GA4 Service Account table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ga4_service_account (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        credentials JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ga4_service_account table created');

    // GA4 Report Cache table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ga4_report_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id VARCHAR(32) NOT NULL,
        report_type VARCHAR(100) NOT NULL,
        date_range_start DATE NOT NULL,
        date_range_end DATE NOT NULL,
        report_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        UNIQUE(property_id, report_type, date_range_start, date_range_end)
      );
    `);
    console.log('✅ ga4_report_cache table created');

    // GA4 API Usage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ga4_api_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id VARCHAR(32) NOT NULL,
        api_method VARCHAR(100) NOT NULL,
        request_count INTEGER DEFAULT 1,
        request_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(property_id, api_method, request_date)
      );
    `);
    console.log('✅ ga4_api_usage table created');

    // Create indexes
    console.log('\n=== Creating Indexes ===');
    await client.query('CREATE INDEX IF NOT EXISTS idx_seoworks_tasks_external_id ON seoworks_tasks(external_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_seoworks_tasks_status ON seoworks_tasks(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ga4_properties_dealership ON ga4_properties(dealership_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ga4_properties_active ON ga4_properties(is_active);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ga4_cache_property ON ga4_report_cache(property_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ga4_cache_expiry ON ga4_report_cache(expires_at);');
    console.log('✅ All indexes created');

    console.log('\n=== Database Setup Complete ===');
    console.log('\nTables created:');
    console.log('- seoworks_tasks');
    console.log('- ga4_properties');
    console.log('- ga4_service_account');
    console.log('- ga4_report_cache');
    console.log('- ga4_api_usage');

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.code === '42P07') {
      console.log('\nSome tables already exist - this is normal');
    }
  } finally {
    await client.end();
  }
}

// Run setup
setupDatabase().catch(console.error);