#!/usr/bin/env node

/**
 * Alpha Test Data Seeder
 * Creates sample data for testing the chat assistant
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedAlphaData() {
  console.log('🌱 Seeding Alpha Test Data...\n');
  
  try {
    // 1. Create test dealership
    await pool.query(`
      INSERT INTO dealerships (id, name, subdomain, contact_email, contact_phone, website_url, settings)
      VALUES (
        'alpha-test-001',
        'Alpha Test Motors',
        'alpha-test',
        'admin@alphatest.com',
        '+15551234567',
        'https://alphatest.com',
        '{"package": "GOLD", "main_brand": "Ford", "target_cities": ["San Francisco", "Oakland", "San Jose"], "target_vehicle_models": ["F-150", "Mustang", "Explorer"]}'
      ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        settings = EXCLUDED.settings
    `);
    console.log('✅ Dealership created');

    // 2. Create admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    
    await pool.query(`
      INSERT INTO users (id, email, password, first_name, last_name, role, dealership_id)
      VALUES (
        'admin-001',
        'admin@alphatest.com',
        $1,
        'John',
        'Doe',
        'admin',
        'alpha-test-001'
      ) ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name
    `, [hashedPassword]);
    console.log('✅ Admin user created');

    // 3. Create SEOWerks onboarding submission
    await pool.query(`
      INSERT INTO seoworks_onboarding_submissions (id, business_name, package, main_brand, target_cities, target_vehicle_models)
      VALUES (
        'alpha-test-001',
        'Alpha Test Motors',
        'GOLD',
        'Ford',
        ARRAY['San Francisco', 'Oakland', 'San Jose'],
        ARRAY['F-150', 'Mustang', 'Explorer']
      ) ON CONFLICT (id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        package = EXCLUDED.package
    `);
    console.log('✅ SEOWerks submission created');

    // 4. Create sample completed tasks
    const tasks = [
      {
        id: 'task-001',
        task_type: 'blog_post',
        status: 'completed',
        dealership_id: 'alpha-test-001',
        post_title: 'Top 5 Ford F-150 Features for 2024',
        post_url: 'https://alphatest.com/blog/f150-features-2024',
        completion_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        completion_notes: 'Successfully published blog post focusing on F-150 features'
      },
      {
        id: 'task-002',
        task_type: 'landing_page',
        status: 'completed',
        dealership_id: 'alpha-test-001',
        post_title: 'Ford Mustang Inventory Page Optimization',
        completion_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        completion_notes: 'Optimized Mustang inventory page for local SEO'
      },
      {
        id: 'task-003',
        task_type: 'seo_optimization',
        status: 'in_progress',
        dealership_id: 'alpha-test-001',
        post_title: 'Explorer Local Search Optimization',
        completion_notes: 'Working on local search optimization for Ford Explorer'
      }
    ];

    for (const task of tasks) {
      await pool.query(`
        INSERT INTO seoworks_tasks (id, task_type, status, dealership_id, post_title, post_url, completion_date, completion_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          completion_notes = EXCLUDED.completion_notes
      `, [task.id, task.task_type, task.status, task.dealership_id, task.post_title, task.post_url || null, task.completion_date || null, task.completion_notes]);
    }
    console.log('✅ Sample tasks created');

    // 5. Create GA4 property
    await pool.query(`
      INSERT INTO ga4_properties (dealership_id, property_id, property_name, sync_status, is_active)
      VALUES (
        'alpha-test-001',
        '493777160',
        'Alpha Test Motors GA4',
        'active',
        true
      ) ON CONFLICT (dealership_id, property_id) DO UPDATE SET
        sync_status = 'active',
        is_active = true
    `);
    console.log('✅ GA4 property linked');

    console.log('\n🎉 Alpha test data seeded successfully!');
    console.log('\nTest credentials:');
    console.log('Email: admin@alphatest.com');
    console.log('Password: TestPass123!');
    console.log('Dealership ID: alpha-test-001');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAlphaData().catch(console.error);

