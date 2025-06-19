#!/usr/bin/env tsx

// Simple script to check what users exist in the database
import { db, checkDatabaseConnection } from "./server/db.js";

async function checkUsers() {
  console.log("🔍 Checking database users...\n");

  try {
    // Test database connection
    const connected = await checkDatabaseConnection();
    if (!connected) {
      console.log("❌ Database connection failed");
      return;
    }
    console.log("✅ Database connected\n");

    // Query users
    const result = await db.execute(
      "SELECT id, username, email, name, role, dealership_id, is_verified FROM users ORDER BY created_at DESC LIMIT 10",
    );

    if (result.length === 0) {
      console.log("ℹ️  No users found in database");
      console.log(
        "💡 Run: tsx server/utils/init-admin.ts to create a super admin user",
      );
    } else {
      console.log(`Found ${result.length} users:`);
      console.log(
        "┌─────────────────────────────────────────────────────────────────────┐",
      );
      console.log(
        "│ USERNAME       │ EMAIL                    │ ROLE             │ VERIFIED │",
      );
      console.log(
        "├─────────────────────────────────────────────────────────────────────┤",
      );

      result.forEach((user) => {
        const username = (user.username || "").padEnd(14);
        const email = (user.email || "").padEnd(24);
        const role = (user.role || "").padEnd(16);
        const verified = user.is_verified ? "Yes" : "No";
        console.log(
          `│ ${username} │ ${email} │ ${role} │ ${verified.padEnd(8)} │`,
        );
      });

      console.log(
        "└─────────────────────────────────────────────────────────────────────┘",
      );
    }
  } catch (error) {
    console.error("❌ Error checking users:", error.message);
  }
}

checkUsers();
