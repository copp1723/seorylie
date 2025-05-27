#!/usr/bin/env tsx

import { config } from 'dotenv';
import { client } from '../server/db';

// Load environment variables
config();

async function checkTables() {
  try {
    console.log('🔍 Checking existing database tables...\n');
    
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('📋 Existing tables:');
    if (tables.length === 0) {
      console.log('   (No tables found)');
    } else {
      tables.forEach(t => console.log(`   • ${t.table_name}`));
    }
    
    console.log(`\n📊 Total: ${tables.length} tables found\n`);
    
    // Check for required base tables
    const requiredTables = ['dealerships', 'users', 'personas', 'api_keys', 'vehicles'];
    const existingTableNames = tables.map(t => t.table_name);
    
    console.log('🔍 Checking required base tables:');
    for (const table of requiredTables) {
      const exists = existingTableNames.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    
    await client.end();
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  }
}

checkTables();
