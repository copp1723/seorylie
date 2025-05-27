#!/usr/bin/env tsx

import { config } from 'dotenv';
import { client } from '../server/db';

// Load environment variables
config();

async function checkMigrationStatus() {
  try {
    console.log('🔍 Checking migration status...\n');
    
    const appliedMigrations = await client`
      SELECT filename, applied_at, checksum
      FROM migrations 
      ORDER BY applied_at
    `;
    
    console.log('✅ Applied migrations:');
    if (appliedMigrations.length === 0) {
      console.log('   (No migrations applied)');
    } else {
      appliedMigrations.forEach(m => {
        console.log(`   • ${m.filename} (${m.applied_at})`);
      });
    }
    
    console.log(`\n📊 Total applied: ${appliedMigrations.length} migrations\n`);
    
    // Check what tables exist now
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('📋 Current database tables:');
    tables.forEach(t => console.log(`   • ${t.table_name}`));
    
    console.log(`\n📊 Total: ${tables.length} tables\n`);
    
    await client.end();
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    process.exit(1);
  }
}

checkMigrationStatus();
