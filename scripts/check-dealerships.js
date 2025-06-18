#!/usr/bin/env node
/**
 * Check dealerships table structure
 */

const { Client } = require('pg');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function checkDealerships() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Get dealerships table structure
    console.log('🔍 Checking dealerships table structure...\n');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dealerships'
      ORDER BY ordinal_position
    `);
    
    console.log('Dealerships columns:');
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.column_default ? `(default: ${col.column_default})` : ''}`);
    });
    
    // Check primary key
    const pkResult = await client.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'dealerships'::regclass AND i.indisprimary;
    `);
    
    console.log(`\nPrimary key: ${pkResult.rows.map(r => r.attname).join(', ')}`);
    
    // Get sample data
    const dataResult = await client.query(`
      SELECT * FROM dealerships LIMIT 5
    `);
    
    console.log(`\nSample data (${dataResult.rows.length} rows):`);
    dataResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Name: ${row.name || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDealerships().catch(console.error);