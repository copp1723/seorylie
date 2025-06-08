#!/usr/bin/env tsx

import { config } from "dotenv";
import { client } from "../server/db";

// Load environment variables
config();

async function checkDealershipsStructure() {
  try {
    console.log("🔍 Checking dealerships table structure...\n");

    const columns = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dealerships' 
      ORDER BY ordinal_position
    `;

    console.log("📋 Dealerships table columns:");
    columns.forEach((c) => {
      console.log(
        `   • ${c.column_name}: ${c.data_type} (${c.is_nullable === "YES" ? "nullable" : "not null"})${c.column_default ? ` default: ${c.column_default}` : ""}`,
      );
    });

    console.log(`\n📊 Total: ${columns.length} columns found\n`);

    await client.end();
  } catch (error) {
    console.error("❌ Error checking dealerships structure:", error);
    process.exit(1);
  }
}

checkDealershipsStructure();
