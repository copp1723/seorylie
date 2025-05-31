#!/usr/bin/env tsx

import { db } from './server/db.js';

async function checkSchema() {
  try {
    console.log('Checking users table schema...');
    const result = await db.execute(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Users table columns:');
    result.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema();