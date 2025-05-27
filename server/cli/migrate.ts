#!/usr/bin/env tsx

/**
 * Migration CLI tool for Rylie AI platform
 *
 * Usage:
 *   npm run migrate                 # Run all pending migrations
 *   npm run migrate:rollback        # Rollback last migration
 *   npm run migrate:rollback 3      # Rollback last 3 migrations
 *   npm run migrate:status          # Show migration status
 *   npm run migrate:validate        # Validate migration files
 */

import { migrationRunner } from '../utils/migration-runner';
import logger from '../utils/logger';
import { checkDatabaseConnection } from '../db';

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;

      case 'validate':
        await validateMigrations();
        break;

      case 'rollback':
        const count = arg ? parseInt(arg, 10) : 1;
        if (isNaN(count) || count < 1) {
          console.error('Invalid rollback count. Must be a positive integer.');
          process.exit(1);
        }
        await rollbackMigrations(count);
        break;

      case 'migrate':
      case undefined:
        await runMigrations();
        break;

      default:
        console.log('Usage:');
        console.log('  migrate               Run all pending migrations');
        console.log('  migrate rollback [n]  Rollback last n migrations (default: 1)');
        console.log('  migrate status        Show migration status');
        console.log('  migrate validate      Validate migration files');
        process.exit(1);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Migration command failed:', { error: err.message });
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

async function showStatus() {
  console.log('📊 Migration Status\n');

  const status = await migrationRunner.status();

  console.log(`Applied migrations: ${status.appliedCount}`);
  console.log(`Pending migrations: ${status.pendingCount}\n`);

  if (status.appliedMigrations.length > 0) {
    console.log('✅ Applied Migrations:');
    status.appliedMigrations.forEach(migration => {
      console.log(`  ${migration.id}: ${migration.filename} (${migration.appliedAt?.toISOString()})`);
    });
    console.log();
  }

  if (status.pendingMigrations.length > 0) {
    console.log('⏳ Pending Migrations:');
    status.pendingMigrations.forEach(migration => {
      console.log(`  ${migration.id}: ${migration.filename}`);
    });
  } else {
    console.log('✨ All migrations are up to date!');
  }
}

async function validateMigrations() {
  console.log('🔍 Validating Migration Files\n');

  const validation = await migrationRunner.validate();

  if (validation.valid) {
    console.log('✅ All migration files are valid!');
  } else {
    console.log('❌ Migration validation failed:\n');
    validation.errors.forEach(error => {
      console.log(`  • ${error}`);
    });
    process.exit(1);
  }
}

async function runMigrations() {
  console.log('🚀 Running Database Migrations\n');

  const results = await migrationRunner.migrate();

  if (results.length === 0) {
    console.log('✨ No pending migrations found. Database is up to date!');
    return;
  }

  console.log('Migration Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    console.log(`  ${status} ${result.migration.filename} ${time}`);

    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  const totalTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);

  console.log(`\n📈 Summary: ${successCount}/${results.length} migrations completed in ${totalTime}ms`);

  if (successCount < results.length) {
    process.exit(1);
  }
}

async function rollbackMigrations(count: number) {
  console.log(`🔄 Rolling Back Last ${count} Migration(s)\n`);

  const results = await migrationRunner.rollback(count);

  if (results.length === 0) {
    console.log('✨ No migrations to rollback.');
    return;
  }

  console.log('Rollback Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    console.log(`  ${status} ${result.migration.filename} ${time}`);

    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  const totalTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);

  console.log(`\n📈 Summary: ${successCount}/${results.length} rollbacks completed in ${totalTime}ms`);

  if (successCount < results.length) {
    process.exit(1);
  }
}

// Run the CLI
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});