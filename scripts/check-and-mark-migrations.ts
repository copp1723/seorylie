#!/usr/bin/env tsx

/**
 * Script to check existing tables and mark migrations as applied
 * This is needed when setting up migrations on an existing database
 */

import dotenv from "dotenv";
dotenv.config();

import { client } from "../server/db";
import logger from "../server/utils/logger";
import fs from "fs";
import path from "path";
import crypto from "crypto";

interface TableInfo {
  table_name: string;
  table_schema: string;
}

interface MigrationFile {
  id: string;
  filename: string;
  path: string;
}

async function checkExistingTables(): Promise<string[]> {
  try {
    const result = await client<TableInfo[]>`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log("\n📋 Existing Tables:");
    result.forEach((table) => {
      console.log(`  • ${table.table_name}`);
    });

    return result.map((table) => table.table_name);
  } catch (error) {
    logger.error("Failed to check existing tables:", error);
    throw error;
  }
}

async function getMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql") && !file.includes("rollback"))
    .sort();

  return files.map((filename) => {
    const id = filename.split("_")[0];
    return {
      id,
      filename,
      path: path.join(migrationsDir, filename),
    };
  });
}

async function checkAppliedMigrations(): Promise<string[]> {
  try {
    const result = await client<{ id: string }[]>`
      SELECT id FROM migrations ORDER BY id;
    `;
    return result.map((row) => row.id);
  } catch (error) {
    // Migrations table might not exist yet
    return [];
  }
}

function calculateChecksum(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function markMigrationAsApplied(migration: MigrationFile): Promise<void> {
  try {
    // Read the migration file to calculate checksum
    const content = fs.readFileSync(migration.path, "utf-8");
    const checksum = calculateChecksum(content);

    await client`
      INSERT INTO migrations (id, filename, applied_at, checksum, execution_time_ms)
      VALUES (${migration.id}, ${migration.filename}, NOW(), ${checksum}, 0)
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log(`  ✅ Marked ${migration.filename} as applied`);
  } catch (error) {
    console.log(`  ❌ Failed to mark ${migration.filename}: ${error}`);
  }
}

async function main() {
  try {
    console.log("🔍 Checking Database State\n");

    // Check existing tables
    const existingTables = await checkExistingTables();

    // Get migration files
    const migrationFiles = await getMigrationFiles();
    console.log(`\n📁 Found ${migrationFiles.length} migration files`);

    // Check applied migrations
    const appliedMigrations = await checkAppliedMigrations();
    console.log(`\n✅ Applied migrations: ${appliedMigrations.length}`);

    // Determine which migrations to mark as applied
    const unappliedMigrations = migrationFiles.filter(
      (migration) => !appliedMigrations.includes(migration.id),
    );

    if (unappliedMigrations.length === 0) {
      console.log("\n✨ All migrations are already marked as applied!");
      return;
    }

    console.log(
      `\n🔄 Marking ${unappliedMigrations.length} migrations as applied:`,
    );

    // Key tables that indicate the database is set up
    const keyTables = [
      "dealerships",
      "leads",
      "conversations",
      "messages",
      "users",
    ];

    const hasKeyTables = keyTables.every((table) =>
      existingTables.includes(table),
    );

    if (hasKeyTables) {
      console.log(
        "\n✅ Database appears to be set up. Marking migrations as applied...",
      );

      for (const migration of unappliedMigrations) {
        await markMigrationAsApplied(migration);
      }

      console.log("\n🎉 All migrations marked as applied!");
    } else {
      console.log("\n⚠️  Database appears to be missing key tables.");
      console.log(
        "Missing tables:",
        keyTables.filter((table) => !existingTables.includes(table)),
      );
      console.log("You may need to run migrations normally.");
    }
  } catch (error) {
    logger.error("Script failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
