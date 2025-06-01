import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { client } from '../db';
import logger from './logger';

interface Migration {
  id: string;
  filename: string;
  appliedAt?: Date;
}

interface MigrationResult {
  success: boolean;
  migration: Migration;
  error?: string;
  executionTime?: number;
}

export class MigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath = path.join(process.cwd(), 'migrations')) {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize the migrations table if it doesn't exist
   */
  private async initializeMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS migrations_applied_at_idx ON migrations(applied_at);
    `;

    await client.unsafe(createTableSQL);
    logger.info('Migrations table initialized');
  }

  /**
   * Get list of pending migrations
   */
  private async getPendingMigrations(): Promise<Migration[]> {
    // Get all migration files
    const migrationFiles = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql') && !file.endsWith('_rollback.sql'))
      .sort();

    // Get applied migrations from database
    const appliedMigrations = await client<{ id: string; filename: string; applied_at: Date }[]>`
      SELECT id, filename, applied_at
      FROM migrations
      ORDER BY applied_at
    `;

    const appliedMigrationIds = new Set(appliedMigrations.map(m => m.id));

    // Return pending migrations
    return migrationFiles
      .filter(filename => {
        const id = this.extractMigrationId(filename);
        return !appliedMigrationIds.has(id);
      })
      .map(filename => ({
        id: this.extractMigrationId(filename),
        filename
      }));
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    await this.initializeMigrationsTable();

    const appliedMigrations = await client<{ id: string; filename: string; applied_at: Date }[]>`
      SELECT id, filename, applied_at
      FROM migrations
      ORDER BY applied_at DESC
    `;

    return appliedMigrations.map(m => ({
      id: m.id,
      filename: m.filename,
      appliedAt: m.applied_at
    }));
  }

  /**
   * Extract migration ID from filename (e.g., "0001_lead_management_schema.sql" -> "0001")
   */
  private extractMigrationId(filename: string): string {
    // Explicitly type the regex match result
    const match: RegExpMatchArray | null = filename.match(/^(\d+)_/);
    if (!match || !match[1]) {
      throw new Error(`Invalid migration filename format: ${filename}`);
    }
    return match[1];
  }

  /**
   * Calculate checksum of migration file
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Read migration file content
   */
  private readMigrationFile(filename: string): string {
    const filePath = path.join(this.migrationsPath, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      logger.info(`Running migration: ${migration.filename}`);

      const content = this.readMigrationFile(migration.filename);
      const checksum = this.calculateChecksum(content);

      // Execute migration in a transaction
      await client.begin(async (tx) => {
        // Run the migration SQL
        await tx.unsafe(content);

        // Record the migration
        await tx`
          INSERT INTO migrations (id, filename, applied_at, checksum, execution_time_ms)
          VALUES (${migration.id}, ${migration.filename}, NOW(), ${checksum}, ${Date.now() - startTime})
        `;
      });

      const executionTime = Date.now() - startTime;
      logger.info(`Migration ${migration.filename} completed in ${executionTime}ms`);

      return {
        success: true,
        migration,
        executionTime
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Migration ${migration.filename} failed:`, { error: err.message });

      return {
        success: false,
        migration,
        error: err.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Run rollback for a specific migration
   */
  private async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Ensure we handle the string replacement properly
      const rollbackFilename = migration.filename.replace(/\.sql$/, '_rollback.sql');
      logger.info(`Rolling back migration: ${migration.filename} using ${rollbackFilename}`);

      const content = this.readMigrationFile(rollbackFilename);

      // Execute rollback in a transaction
      await client.begin(async (tx) => {
        // Run the rollback SQL
        await tx.unsafe(content);

        // Remove the migration record
        await tx`
          DELETE FROM migrations
          WHERE id = ${migration.id}
        `;
      });

      const executionTime = Date.now() - startTime;
      logger.info(`Rollback ${rollbackFilename} completed in ${executionTime}ms`);

      return {
        success: true,
        migration,
        executionTime
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Rollback for ${migration.filename} failed:`, { error: err.message });

      return {
        success: false,
        migration,
        error: err.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    await this.initializeMigrationsTable();

    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations found');
      return [];
    }

    logger.info(`Found ${pendingMigrations.length} pending migrations`);

    const results: MigrationResult[] = [];

    for (const migration of pendingMigrations) {
      const result = await this.runMigration(migration);
      results.push(result);

      if (!result.success) {
        logger.error(`Migration failed: ${migration.filename}. Stopping migration process.`);
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);

    logger.info(`Migration complete: ${successCount}/${results.length} migrations applied in ${totalTime}ms`);

    return results;
  }

  /**
   * Rollback the last N migrations
   */
  async rollback(count = 1): Promise<MigrationResult[]> {
    await this.initializeMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return [];
    }

    const migrationsToRollback = appliedMigrations.slice(0, count);
    logger.info(`Rolling back ${migrationsToRollback.length} migrations`);

    const results: MigrationResult[] = [];

    for (const migration of migrationsToRollback) {
      const result = await this.rollbackMigration(migration);
      results.push(result);

      if (!result.success) {
        logger.error(`Rollback failed: ${migration.filename}. Stopping rollback process.`);
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);

    logger.info(`Rollback complete: ${successCount}/${results.length} migrations rolled back in ${totalTime}ms`);

    return results;
  }

  /**
   * Get migration status
   */
  async status(): Promise<{
    appliedCount: number;
    pendingCount: number;
    appliedMigrations: Migration[];
    pendingMigrations: Migration[];
  }> {
    await this.initializeMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = await this.getPendingMigrations();

    return {
      appliedCount: appliedMigrations.length,
      pendingCount: pendingMigrations.length,
      appliedMigrations,
      pendingMigrations
    };
  }

  /**
   * Validate migration files
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const migrationFiles = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql') && !file.endsWith('_rollback.sql'))
        .sort();

      for (const filename of migrationFiles) {
        try {
          this.extractMigrationId(filename);

          // Check if rollback file exists
          const rollbackFilename = filename.replace(/\.sql$/, '_rollback.sql');
          const rollbackPath = path.join(this.migrationsPath, rollbackFilename);

          if (!fs.existsSync(rollbackPath)) {
            errors.push(`Missing rollback file for ${filename}: ${rollbackFilename}`);
          }

          // Validate file content can be read
          this.readMigrationFile(filename);

        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push(`Invalid migration file ${filename}: ${err.message}`);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(`Failed to read migrations directory: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Default export
export const migrationRunner = new MigrationRunner();