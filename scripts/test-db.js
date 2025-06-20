#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function testDB() {
  console.log('🧪 Testing Database Connection...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log('Current time:', result.rows[0].current_time);
    
    // Test if our tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Available tables:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Test user login
    const userResult = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE email = $1',
      ['admin@alphatest.com']
    );
    
    if (userResult.rows.length > 0) {
      console.log('\n👤 Test user found:');
      console.log(`  - Email: ${userResult.rows[0].email}`);
      console.log(`  - Name: ${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`);
    } else {
      console.log('\n❌ Test user not found');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

testDB().catch(console.error);

