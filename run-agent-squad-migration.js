#!/usr/bin/env tsx

/**
 * Agent Squad Migration Runner
 * Specifically runs the Agent Squad database migration and verifies the setup
 */

import { migrationRunner } from './server/utils/migration-runner';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runAgentSquadMigration() {
  console.log('🚀 Starting Agent Squad Database Migration...\n');

  try {
    // Check migration status first
    console.log('📊 Checking current migration status...');
    const status = await migrationRunner.status();
    
    console.log(`Applied migrations: ${status.appliedCount}`);
    console.log(`Pending migrations: ${status.pendingCount}\n`);

    // Look for Agent Squad specific migration
    const agentSquadMigration = status.pendingMigrations.find(
      m => m.filename.includes('agent_squad_tracking')
    );

    if (!agentSquadMigration) {
      console.log('✅ Agent Squad migration already applied or not found in pending migrations');
      console.log('   Checking if Agent Squad tables exist...\n');
      
      // Verify Agent Squad tables exist
      await verifyAgentSquadTables();
      return;
    }

    console.log(`🎯 Found Agent Squad migration: ${agentSquadMigration.filename}`);
    console.log('⚡ Running migration...\n');

    // Run migrations - this will apply all pending migrations up to and including Agent Squad
    const results = await migrationRunner.migrate();

    // Report results
    let agentSquadResult = null;
    let totalExecutionTime = 0;

    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.migration.filename} (${result.executionTime}ms)`);
      
      if (result.migration.filename.includes('agent_squad_tracking')) {
        agentSquadResult = result;
      }
      
      totalExecutionTime += result.executionTime || 0;
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    console.log(`\n⏱️  Total execution time: ${totalExecutionTime}ms`);

    if (agentSquadResult && agentSquadResult.success) {
      console.log('\n🎉 Agent Squad migration completed successfully!');
      console.log('   Verifying Agent Squad tables...\n');
      
      // Verify the tables were created correctly
      await verifyAgentSquadTables();
      
    } else if (agentSquadResult && !agentSquadResult.success) {
      console.error('\n❌ Agent Squad migration failed!');
      console.error(`   Error: ${agentSquadResult.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration process failed:');
    console.error('  ', error.message);
    process.exit(1);
  }
}

async function verifyAgentSquadTables() {
  try {
    console.log('🔍 Verifying Agent Squad database setup...');
    
    // Import client to check tables
    const { client } = await import('./server/db/index');
    
    // Check agent_squad_config table
    const configCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_squad_config'
      ) as exists
    `;
    
    if (configCheck[0].exists) {
      console.log('✅ agent_squad_config table created');
      
      // Check columns
      const configColumns = await client`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agent_squad_config'
        ORDER BY ordinal_position
      `;
      console.log(`   Columns: ${configColumns.map(c => c.column_name).join(', ')}`);
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
      
      // Check columns
      const analyticsColumns = await client`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agent_squad_analytics'
        ORDER BY ordinal_position
      `;
      console.log(`   Columns: ${analyticsColumns.map(c => c.column_name).join(', ')}`);
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
runAgentSquadMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});