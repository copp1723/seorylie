#!/usr/bin/env node

/**
 * Database Migration Runner
 *
 * This script provides a comprehensive migration system for the CleanRylie database.
 * It supports running migrations up/down, tracking migration state, and providing
 * rollback capabilities.
 *
 * Usage:
 *   npm run migrate:up [target]      - Run migrations forward
 *   npm run migrate:down [target]    - Rollback migrations
 *   npm run migrate:status           - Show migration status
 *   npm run migrate:create <name>    - Create new migration
 */

import fs from "fs/promises";
import path from "path";
import { Client } from "pg";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { config } from "dotenv";

// Load environment variables
config();

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");

// Parse DATABASE_URL or use individual environment variables as fallback
function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1), // Remove leading slash
        user: url.username,
        password: url.password,
        ssl:
          url.hostname.includes("render.com") ||
          url.hostname.includes("supabase.co")
            ? { rejectUnauthorized: false }
            : process.env.DB_SSL === "true"
              ? { rejectUnauthorized: false }
              : false,
      };
    } catch (error) {
      console.error(
        "Failed to parse DATABASE_URL, falling back to individual env vars",
      );
    }
  }

  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "cleanrylie",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

const DB_CONNECTION = getDatabaseConfig();

// Debug: Log the database configuration (without password)
console.log("Database configuration:", {
  host: DB_CONNECTION.host,
  port: DB_CONNECTION.port,
  database: DB_CONNECTION.database,
  user: DB_CONNECTION.user,
  ssl: !!DB_CONNECTION.ssl,
});

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

interface Migration {
  id: string;
  name: string;
  filePath: string;
  rollbackPath?: string;
  checksum: string;
  appliedAt?: Date;
}

interface MigrationRecord {
  id: string;
  name: string;
  checksum: string;
  applied_at: Date;
}

class MigrationRunner {
  private client: Client;

  constructor() {
    this.client = new Client(DB_CONNECTION);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log(`${colors.green}✓${colors.reset} Connected to database`);
    } catch (error) {
      console.error(
        `${colors.red}✗${colors.reset} Failed to connect to database:`,
        error,
      );
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  /**
   * Ensure the migrations table exists
   */
  async ensureMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER,
        UNIQUE(name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
      ON schema_migrations(applied_at);
    `;

    await this.client.query(createTableSQL);
    console.log(`${colors.blue}ℹ${colors.reset} Migrations table ready`);
  }

  /**
   * Get all migration files from the migrations directory
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(MIGRATIONS_DIR);
      const migrationFiles = files
        .filter(
          (file) => file.endsWith(".sql") && !file.endsWith("_rollback.sql"),
        )
        .sort();

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const checksum = createHash("sha256")
          .update(content)
          .digest("hex")
          .substring(0, 16);

        // Extract migration ID and name from filename
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (!match) continue;

        const [, id, name] = match;

        // Check for rollback file
        const rollbackFile = file.replace(".sql", "_rollback.sql");
        const rollbackPath = path.join(MIGRATIONS_DIR, rollbackFile);

        let hasRollback = false;
        try {
          await fs.access(rollbackPath);
          hasRollback = true;
        } catch {
          // Rollback file doesn't exist
        }

        migrations.push({
          id,
          name: name.replace(/_/g, " "),
          filePath,
          rollbackPath: hasRollback ? rollbackPath : undefined,
          checksum,
        });
      }

      return migrations;
    } catch (error) {
      console.error(
        `${colors.red}✗${colors.reset} Failed to read migrations directory:`,
        error,
      );
      process.exit(1);
    }
  }

  /**
   * Get applied migrations from the database
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.client.query(
      "SELECT id, name, checksum, applied_at FROM schema_migrations ORDER BY applied_at",
    );
    return result.rows;
  }

  /**
   * Run a migration up
   */
  async runMigrationUp(migration: Migration): Promise<void> {
    const startTime = Date.now();
    console.log(
      `${colors.yellow}→${colors.reset} Running migration: ${migration.id}_${migration.name.replace(/\s/g, "_")}`,
    );

    try {
      // Read and execute migration file
      const content = await fs.readFile(migration.filePath, "utf-8");

      // Start transaction
      await this.client.query("BEGIN");

      // Execute migration
      await this.client.query(content);

      // Record migration
      const executionTime = Date.now() - startTime;
      await this.client.query(
        "INSERT INTO schema_migrations (id, name, checksum, execution_time_ms) VALUES ($1, $2, $3, $4)",
        [migration.id, migration.name, migration.checksum, executionTime],
      );

      await this.client.query("COMMIT");

      console.log(
        `${colors.green}✓${colors.reset} Migration completed in ${executionTime}ms`,
      );
    } catch (error) {
      await this.client.query("ROLLBACK");
      console.error(`${colors.red}✗${colors.reset} Migration failed:`, error);
      throw error;
    }
  }

  /**
   * Run a migration down (rollback)
   */
  async runMigrationDown(migration: Migration): Promise<void> {
    const startTime = Date.now();
    console.log(
      `${colors.yellow}←${colors.reset} Rolling back migration: ${migration.id}_${migration.name.replace(/\s/g, "_")}`,
    );

    if (!migration.rollbackPath) {
      throw new Error(`No rollback script found for migration ${migration.id}`);
    }

    try {
      // Read and execute rollback file
      const content = await fs.readFile(migration.rollbackPath, "utf-8");

      // Start transaction
      await this.client.query("BEGIN");

      // Execute rollback
      await this.client.query(content);

      // Remove migration record
      await this.client.query("DELETE FROM schema_migrations WHERE id = $1", [
        migration.id,
      ]);

      await this.client.query("COMMIT");

      const executionTime = Date.now() - startTime;
      console.log(
        `${colors.green}✓${colors.reset} Rollback completed in ${executionTime}ms`,
      );
    } catch (error) {
      await this.client.query("ROLLBACK");
      console.error(`${colors.red}✗${colors.reset} Rollback failed:`, error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async showStatus(): Promise<void> {
    console.log(`${colors.bold}Migration Status${colors.reset}\n`);

    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map((m) => m.id));

    console.log(
      "ID".padEnd(6) + "Name".padEnd(40) + "Status".padEnd(12) + "Applied At",
    );
    console.log("-".repeat(80));

    for (const migration of availableMigrations) {
      const isApplied = appliedIds.has(migration.id);
      const appliedRecord = appliedMigrations.find(
        (m) => m.id === migration.id,
      );

      const status = isApplied
        ? `${colors.green}Applied${colors.reset}`
        : `${colors.yellow}Pending${colors.reset}`;

      const appliedAt = appliedRecord
        ? appliedRecord.applied_at.toISOString()
        : "-";

      console.log(
        migration.id.padEnd(6) +
          migration.name.substring(0, 38).padEnd(40) +
          status.padEnd(20) + // Extra padding for color codes
          appliedAt,
      );
    }

    console.log(`\nTotal migrations: ${availableMigrations.length}`);
    console.log(`Applied: ${appliedMigrations.length}`);
    console.log(
      `Pending: ${availableMigrations.length - appliedMigrations.length}`,
    );
  }

  /**
   * Run migrations up to a target
   */
  async migrateUp(target?: string): Promise<void> {
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map((m) => m.id));

    // Find migrations to run
    const migrationsToRun = availableMigrations.filter((migration) => {
      if (appliedIds.has(migration.id)) return false;
      if (target && migration.id > target) return false;
      return true;
    });

    if (migrationsToRun.length === 0) {
      console.log(
        `${colors.green}✓${colors.reset} All migrations are up to date`,
      );
      return;
    }

    console.log(
      `${colors.blue}ℹ${colors.reset} Running ${migrationsToRun.length} migration(s)\n`,
    );

    for (const migration of migrationsToRun) {
      await this.runMigrationUp(migration);
    }

    console.log(
      `\n${colors.green}✓${colors.reset} All migrations completed successfully`,
    );
  }

  /**
   * Run migrations down to a target
   */
  async migrateDown(target?: string): Promise<void> {
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    // Find migrations to rollback (in reverse order)
    const migrationsToRollback = appliedMigrations
      .filter((applied) => {
        if (target && applied.id <= target) return false;
        return true;
      })
      .reverse();

    if (migrationsToRollback.length === 0) {
      console.log(`${colors.green}✓${colors.reset} No migrations to rollback`);
      return;
    }

    console.log(
      `${colors.blue}ℹ${colors.reset} Rolling back ${migrationsToRollback.length} migration(s)\n`,
    );

    for (const appliedMigration of migrationsToRollback) {
      const migration = availableMigrations.find(
        (m) => m.id === appliedMigration.id,
      );
      if (!migration) {
        console.error(
          `${colors.red}✗${colors.reset} Migration file not found for ${appliedMigration.id}`,
        );
        continue;
      }

      await this.runMigrationDown(migration);
    }

    console.log(
      `\n${colors.green}✓${colors.reset} All rollbacks completed successfully`,
    );
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<void> {
    if (!name) {
      console.error(`${colors.red}✗${colors.reset} Migration name is required`);
      process.exit(1);
    }

    // Generate migration ID (timestamp)
    const now = new Date();
    const id = now
      .toISOString()
      .replace(/[-:T]/g, "")
      .replace(/\.\d{3}Z/, "");

    // Clean migration name
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    // Create file paths
    const migrationFile = path.join(MIGRATIONS_DIR, `${id}_${cleanName}.sql`);
    const rollbackFile = path.join(
      MIGRATIONS_DIR,
      `${id}_${cleanName}_rollback.sql`,
    );

    // Create migration template
    const migrationTemplate = `-- Migration: ${id}_${cleanName}.sql
-- Description: ${name}
-- Created: ${now.toISOString()}

-- Your migration SQL goes here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- CREATE INDEX idx_example_table_name ON example_table(name);
`;

    const rollbackTemplate = `-- Rollback: ${id}_${cleanName}_rollback.sql
-- Description: Rollback for ${name}
-- Created: ${now.toISOString()}

-- Your rollback SQL goes here (reverse of the migration)
-- Example:
-- DROP INDEX IF EXISTS idx_example_table_name;
-- DROP TABLE IF EXISTS example_table;
`;

    // Write files
    await fs.writeFile(migrationFile, migrationTemplate);
    await fs.writeFile(rollbackFile, rollbackTemplate);

    console.log(`${colors.green}✓${colors.reset} Created migration files:`);
    console.log(`  - ${path.relative(process.cwd(), migrationFile)}`);
    console.log(`  - ${path.relative(process.cwd(), rollbackFile)}`);
  }

  /**
   * Check database connection and display info
   */
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      const result = await this.client.query(
        "SELECT version(), current_database(), current_user",
      );
      const dbInfo = result.rows[0];

      console.log(
        `${colors.green}✓${colors.reset} Database connection successful`,
      );
      console.log(`  Database: ${dbInfo.current_database}`);
      console.log(`  User: ${dbInfo.current_user}`);
      console.log(
        `  Version: ${dbInfo.version.split(" ")[0] + " " + dbInfo.version.split(" ")[1]}`,
      );

      return true;
    } catch (error) {
      console.error(
        `${colors.red}✗${colors.reset} Database connection failed:`,
        error,
      );
      return false;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];

  const runner = new MigrationRunner();

  try {
    await runner.connect();
    await runner.ensureMigrationsTable();

    switch (command) {
      case "up":
        await runner.migrateUp(target);
        break;
      case "down":
        await runner.migrateDown(target);
        break;
      case "status":
        await runner.showStatus();
        break;
      case "create":
        await runner.createMigration(target);
        break;
      case "check":
        await runner.checkDatabaseConnection();
        break;
      default:
        console.log(
          `${colors.bold}CleanRylie Migration Runner${colors.reset}\n`,
        );
        console.log("Usage:");
        console.log(
          "  npm run migrate:up [target]      - Run migrations forward",
        );
        console.log("  npm run migrate:down [target]    - Rollback migrations");
        console.log(
          "  npm run migrate:status           - Show migration status",
        );
        console.log(
          "  npm run migrate:create <name>    - Create new migration",
        );
        console.log(
          "  npm run migrate:check            - Check database connection",
        );
        console.log("\nExamples:");
        console.log(
          "  npm run migrate:up               - Run all pending migrations",
        );
        console.log(
          "  npm run migrate:up 0005          - Run migrations up to 0005",
        );
        console.log(
          "  npm run migrate:down 0003        - Rollback to migration 0003",
        );
        console.log('  npm run migrate:create "add user roles"');
        break;
    }
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Migration failed:`, error);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MigrationRunner };
