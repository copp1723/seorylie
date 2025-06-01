#!/usr/bin/env tsx

/**
 * Direct Agent Squad Migration Runner
 * Runs the Agent Squad migration directly using the database client
 */

import * as fs from 'fs';
import * as path from 'path';
import { client } from './server/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function runAgentSquadMigrationDirect() {
  console.log('🚀 Running Agent Squad Migration Directly...\n');

  try {
    // Read the Agent Squad migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '0002_agent_squad_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📖 Agent Squad migration loaded');
    console.log('⚡ Executing migration...\n');

    // Execute the migration in a transaction
    await client.begin(async (tx) => {
      // Run the migration SQL
      await tx.unsafe(migrationSQL);
      
      console.log('✅ Agent Squad migration executed successfully');
      
      // Record the migration manually
      await tx`
        INSERT INTO migrations (id, filename, applied_at, checksum, execution_time_ms)
        VALUES ('0002', '0002_agent_squad_tracking.sql', NOW(), 'manual', 0)
        ON CONFLICT (id) DO NOTHING
      `;
      
      console.log('✅ Migration recorded in migrations table');
    });

    console.log('\n🎉 Agent Squad migration completed successfully!');
    console.log('   Verifying Agent Squad tables...\n');
    
    // Verify the tables were created correctly
    await verifyAgentSquadTables();
    
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error('  ', error.message);
    process.exit(1);
  }
}

async function verifyAgentSquadTables() {
  try {
    console.log('🔍 Verifying Agent Squad database setup...');
    
    // Check agent_squad_config table
    const configCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_squad_config'
      ) as exists
    `;
    
    if (configCheck[0].exists) {
      console.log('✅ agent_squad_config table created');
      
      // Check record count
      const configCount = await client`SELECT COUNT(*) as count FROM agent_squad_config`;
      console.log(`   Records: ${configCount[0].count}`);
    } else {
      console.log('❌ agent_squad_config table missing');
    }

    // Check agent_squad_analytics table
    const analyticsCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_squad_analytics'
      ) as exists
    `;
    
    if (analyticsCheck[0].exists) {
      console.log('✅ agent_squad_analytics table created');
    } else {
      console.log('❌ agent_squad_analytics table missing');
    }

    // Check messages table for Agent Squad columns
    const messagesCheck = await client`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'messages' 
      AND column_name IN ('selected_agent', 'agent_confidence', 'processing_time_ms', 'agent_reasoning')
    `;
    
    if (messagesCheck.length > 0) {
      console.log('✅ messages table enhanced with Agent Squad tracking');
      console.log(`   New columns: ${messagesCheck.map(c => c.column_name).join(', ')}`);
    } else {
      console.log('❌ messages table missing Agent Squad columns');
    }

    // Check performance view
    const viewCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'agent_squad_performance'
      ) as exists
    `;
    
    if (viewCheck[0].exists) {
      console.log('✅ agent_squad_performance view created');
    } else {
      console.log('❌ agent_squad_performance view missing');
    }

    // Check indexes
    const indexCheck = await client`
      SELECT indexname FROM pg_indexes 
      WHERE tablename IN ('messages', 'agent_squad_analytics')
      AND indexname LIKE '%agent%'
      ORDER BY indexname
    `;
    
    if (indexCheck.length > 0) {
      console.log('✅ Agent Squad indexes created');
      console.log(`   Indexes: ${indexCheck.map(i => i.indexname).join(', ')}`);
    } else {
      console.log('❌ Agent Squad indexes missing');
    }

    console.log('\n🎯 Agent Squad database verification complete!');
    
  } catch (error) {
    console.error('❌ Table verification failed:');
    console.error('  ', error.message);
  }
}

// Run the migration
runAgentSquadMigrationDirect().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});