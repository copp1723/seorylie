#!/usr/bin/env tsx

import postgres from "postgres";
import bcrypt from "bcrypt";

async function createMinimalAdmin() {
  console.log("🔐 Creating Minimal Admin User...\n");

  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  try {
    // Check if admin already exists
    const existingAdmin = await sql`
      SELECT username, email, role FROM users WHERE role = 'super_admin' LIMIT 1
    `;

    if (existingAdmin.length > 0) {
      console.log("✅ Admin already exists:");
      console.log(`   Username: ${existingAdmin[0].username}`);
      console.log(`   Email: ${existingAdmin[0].email}`);
      console.log(`   Role: ${existingAdmin[0].role}\n`);
      await sql.end();
      return;
    }

    // Get the first dealership or use null
    const dealerships = await sql`SELECT id FROM dealerships LIMIT 1`;
    const dealershipId = dealerships.length > 0 ? dealerships[0].id : null;

    if (dealershipId) {
      console.log(`Using existing dealership ID: ${dealershipId}`);
    } else {
      console.log(
        "No dealership found, creating admin without dealership association",
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create admin user with minimal fields
    console.log("Creating admin user...");
    await sql`
      INSERT INTO users (username, email, password, role, dealership_id, created_at, updated_at)
      VALUES (
        'admin', 
        'admin@alpha.ai', 
        ${hashedPassword},
        'super_admin', 
        ${dealershipId}, 
        NOW(), 
        NOW()
      )
    `;

    console.log("✅ Admin user created successfully!");
    console.log("📋 Login Credentials:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   Email: admin@alpha.ai");
    console.log("   Role: super_admin\n");

    console.log("🌐 Next Steps:");
    console.log("   1. Open browser: http://localhost:3000");
    console.log("   2. Login with admin/admin123");
    console.log("   3. Navigate to Admin > Dealerships");
    console.log("   4. Create your first alpha dealership!\n");
  } catch (error) {
    console.error("❌ Failed to create admin:", error);
  } finally {
    await sql.end();
  }
}

createMinimalAdmin();
