#!/usr/bin/env tsx

import postgres from "postgres";

async function fixSchema() {
  console.log("🔧 Fixing database schema...\n");

  // Use environment DATABASE_URL
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  try {
    // Check if is_active column exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_active'
    `;

    if (columnCheck.length === 0) {
      console.log("Adding is_active column to users table...");
      await sql`
        ALTER TABLE users 
        ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL
      `;
      console.log("✅ Added is_active column successfully");
    } else {
      console.log("✅ is_active column already exists");
    }

    // Verify the column was added
    const verify = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_active'
    `;

    if (verify.length > 0) {
      console.log("Column verification:", verify[0]);
    }

    console.log("\n🎯 Schema fix completed successfully!");
  } catch (error) {
    console.error("❌ Schema fix failed:", error);
  } finally {
    await sql.end();
  }
}

fixSchema();
