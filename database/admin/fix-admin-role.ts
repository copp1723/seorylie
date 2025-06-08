#!/usr/bin/env tsx

import postgres from "postgres";

async function fixAdminRole() {
  console.log("🔧 Fixing admin user role to super_admin...\n");

  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  try {
    // Check current admin user roles
    console.log("Current admin users:");
    const currentAdmins = await sql`
      SELECT id, username, email, role FROM users 
      WHERE role IN ('admin', 'dealership_admin', 'super_admin')
      ORDER BY id
    `;

    currentAdmins.forEach((user) => {
      console.log(`  - ${user.username} (${user.email}): ${user.role}`);
    });

    // Update admin users to super_admin role
    console.log("\nUpdating admin users to super_admin role...");
    const updatedUsers = await sql`
      UPDATE users 
      SET role = 'super_admin', updated_at = NOW()
      WHERE username = 'admin' OR role IN ('admin', 'dealership_admin')
      RETURNING id, username, email, role
    `;

    if (updatedUsers.length > 0) {
      console.log("✅ Successfully updated admin users:");
      updatedUsers.forEach((user) => {
        console.log(`  - ${user.username} (${user.email}): ${user.role}`);
      });
    } else {
      console.log("⚠️  No admin users found to update");
    }

    // Verify the fix
    console.log("\nVerifying super admin access...");
    const superAdmins = await sql`
      SELECT id, username, email, role FROM users 
      WHERE role = 'super_admin'
      ORDER BY id
    `;

    if (superAdmins.length > 0) {
      console.log("✅ Super admin users confirmed:");
      superAdmins.forEach((user) => {
        console.log(`  - ${user.username} (${user.email}): ${user.role}`);
      });
      console.log(
        "\n🎯 Admin users should now have access to admin dashboard!",
      );
    } else {
      console.log(
        "❌ No super admin users found. Manual intervention required.",
      );
    }
  } catch (error) {
    console.error("❌ Failed to fix admin role:", error);
  } finally {
    await sql.end();
  }
}

fixAdminRole();
