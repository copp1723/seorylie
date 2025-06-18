#!/usr/bin/env node
/**
 * Apply database migrations
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function applyMigrations() {
  console.log('🔄 Applying database migrations...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Get migration files
    const migrationDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationDir)
      .filter(f => f.match(/^002[0-3].*\.sql$/) && !f.includes('rollback'))
      .sort();
    
    console.log(`Found ${files.length} migrations to apply:\n`);
    
    for (const file of files) {
      console.log(`📄 Applying ${file}...`);
      
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Split by semicolons but be careful with functions
        const statements = sql
          .split(/;\s*$/m)
          .filter(stmt => stmt.trim())
          .map(stmt => stmt.trim() + ';');
        
        // Apply each statement
        for (const statement of statements) {
          if (statement.trim() && !statement.match(/^\s*--/)) {
            await client.query(statement);
          }
        }
        
        console.log(`✅ Successfully applied ${file}\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${file} - Some objects already exist (skipping)\n`);
        } else {
          console.error(`❌ Error applying ${file}:`, error.message);
          throw error;
        }
      }
    }
    
    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    
    const checkTables = [
      'seo_tasks',
      'deliverables', 
      'performance_metrics',
      'ga4_service_accounts',
      'ga4_data_streams',
      'audit_logs',
      'activity_logs'
    ];
    
    for (const table of checkTables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      const exists = result.rows[0].exists;
      console.log(`  ${table.padEnd(25)} - ${exists ? '✅ Created' : '❌ Not found'}`);
    }
    
    console.log('\n✅ Migration process complete!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
applyMigrations().catch(console.error);