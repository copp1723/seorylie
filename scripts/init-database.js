#!/usr/bin/env node

/**
 * Database Initialization Script
 * Creates all necessary tables for the alpha test
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  console.log('🔧 Initializing database...\n');
  
  try {
    // Create dealerships table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealerships (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_phone VARCHAR(50),
        website_url VARCHAR(500),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Dealerships table created');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'user',
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create SEOWerks onboarding submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seoworks_onboarding_submissions (
        id VARCHAR(255) PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        package VARCHAR(50) NOT NULL,
        main_brand VARCHAR(100),
        target_cities TEXT[],
        target_vehicle_models TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ SEOWerks onboarding table created');

    // Create SEOWerks tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seoworks_tasks (
        id VARCHAR(255) PRIMARY KEY,
        task_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        post_title VARCHAR(500),
        post_url VARCHAR(500),
        completion_date TIMESTAMP,
        completion_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ SEOWerks tasks table created');

    // Create chat conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(255) PRIMARY KEY,
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        user_id VARCHAR(255) REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Chat conversations table created');

    // Create chat messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) REFERENCES chat_conversations(id),
        message_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Chat messages table created');

    // Create SEO requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seo_requests (
        id VARCHAR(255) PRIMARY KEY,
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        user_id VARCHAR(255) REFERENCES users(id),
        request_type VARCHAR(100) NOT NULL,
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        description TEXT NOT NULL,
        additional_context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ SEO requests table created');

    // Create GA4 properties table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ga4_properties (
        id SERIAL PRIMARY KEY,
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        property_id VARCHAR(100) NOT NULL,
        property_name VARCHAR(255),
        sync_status VARCHAR(50) DEFAULT 'pending',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dealership_id, property_id)
      )
    `);
    console.log('✅ GA4 properties table created');

    // Create GA4 data cache table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ga4_data_cache (
        id SERIAL PRIMARY KEY,
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC,
        date_range VARCHAR(50),
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        UNIQUE(dealership_id, metric_name, date_range)
      )
    `);
    console.log('✅ GA4 data cache table created');

    // Create usage tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id SERIAL PRIMARY KEY,
        dealership_id VARCHAR(255) REFERENCES dealerships(id),
        action VARCHAR(100) NOT NULL,
        details JSONB DEFAULT '{}',
        tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Usage tracking table created');

    console.log('\n🎉 Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase().catch(console.error);

