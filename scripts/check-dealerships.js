#!/usr/bin/env node

// Quick script to check existing dealerships
import pkg from 'pg';
const { Pool } = pkg;

async function checkDealerships() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Checking existing dealerships...');
    
    // First check what columns exist
    const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'dealerships'");
    console.log('Available columns:', columns.rows.map(r => r.column_name));

    const result = await pool.query('SELECT id, name, contact_email, subdomain FROM dealerships ORDER BY id LIMIT 15');
    
    if (result.rows.length === 0) {
      console.log('No dealerships found. We can use ID 1 for Kunes RV Fox.');
      return 1;
    }
    
    console.log('Existing dealerships:');
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}, Name: ${row.name}, Email: ${row.contact_email}, Subdomain: ${row.subdomain}`);
    });
    
    // Find next available ID
    const maxId = Math.max(...result.rows.map(row => row.id));
    const nextId = maxId + 1;
    console.log(`\nNext available ID: ${nextId}`);
    return nextId;
    
  } catch (error) {
    console.error('Error checking dealerships:', error.message);
    return 1; // Default to ID 1
  } finally {
    await pool.end();
  }
}

checkDealerships().then(id => {
  console.log(`\nRecommended dealership ID for Kunes RV Fox: ${id}`);
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
