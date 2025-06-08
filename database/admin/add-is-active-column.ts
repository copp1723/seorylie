#!/usr/bin/env tsx

import { db } from "./server/db.js";

async function addIsActiveColumn() {
  try {
    console.log("Adding is_active column to users table...");

    // Add the is_active column if it doesn't exist
    await db.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
    `);

    console.log("✅ Successfully added is_active column to users table");
  } catch (error) {
    console.error("❌ Failed to add is_active column:", error);
  }
}

addIsActiveColumn();
