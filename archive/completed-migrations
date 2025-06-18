#!/usr/bin/env tsx

/**
 * Script to manually apply the ADF migration
 */

import dotenv from "dotenv";
dotenv.config();

import { client } from "../server/db";
import logger from "../server/utils/logger";
import fs from "fs";
import path from "path";

async function checkAdfTables(): Promise<string[]> {
  try {
    const result = await client<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'adf_%'
      ORDER BY table_name;
    `;

    return result.map((table) => table.table_name);
  } catch (error) {
    logger.error("Failed to check ADF tables:", error);
    throw error;
  }
}

async function applyAdfMigration(): Promise<void> {
  try {
    const migrationPath = path.join(
      process.cwd(),
      "migrations",
      "0010_adf_lead_ingestion_system.sql",
    );
    let migrationContent = fs.readFileSync(migrationPath, "utf-8");

    console.log("📦 Applying ADF migration...");

    // Remove BEGIN and COMMIT statements as postgres.js handles transactions differently
    migrationContent = migrationContent
      .replace(/^BEGIN;?\s*$/gm, "")
      .replace(/^COMMIT;?\s*$/gm, "")
      .trim();

    // Execute the migration using begin transaction
    await client.begin(async (tx) => {
      await tx.unsafe(migrationContent);
    });

    console.log("✅ ADF migration applied successfully");
  } catch (error) {
    logger.error("Failed to apply ADF migration:", error);
    throw error;
  }
}

async function applyAdfSmsMigration(): Promise<void> {
  try {
    const migrationPath = path.join(
      process.cwd(),
      "migrations",
      "0011_adf_sms_responses_table.sql",
    );
    let migrationContent = fs.readFileSync(migrationPath, "utf-8");

    console.log("📦 Applying ADF SMS migration...");

    // Execute the migration using begin transaction
    await client.begin(async (tx) => {
      await tx.unsafe(migrationContent);
    });

    console.log("✅ ADF SMS migration applied successfully");
  } catch (error) {
    logger.error("Failed to apply ADF SMS migration:", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("🔍 Checking ADF Tables\n");

    // Check existing ADF tables
    const existingAdfTables = await checkAdfTables();

    if (existingAdfTables.length > 0) {
      console.log("📋 Existing ADF Tables:");
      existingAdfTables.forEach((table) => {
        console.log(`  • ${table}`);
      });

      // Check if SMS tables exist
      const hasSmsTable = existingAdfTables.includes("adf_sms_responses");
      if (!hasSmsTable) {
        console.log("\n📦 Applying ADF SMS migration...");
        await applyAdfSmsMigration();
      } else {
        console.log("\n✨ All ADF tables already exist!");
      }
    } else {
      console.log("❌ No ADF tables found. Applying migrations...\n");
      await applyAdfMigration();
      await applyAdfSmsMigration();

      // Check again
      const newAdfTables = await checkAdfTables();
      console.log("\n📋 Created ADF Tables:");
      newAdfTables.forEach((table) => {
        console.log(`  • ${table}`);
      });
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
