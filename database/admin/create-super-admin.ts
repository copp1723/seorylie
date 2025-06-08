#!/usr/bin/env tsx

import { db } from "./server/db.js";
import { users, dealerships } from "./shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function createSuperAdmin() {
  console.log("🔐 Creating Super Admin User...\n");

  try {
    // Check if super admin already exists
    const existingSuperAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, "super_admin"))
      .limit(1);

    if (existingSuperAdmin.length > 0) {
      console.log("✅ Super admin already exists:");
      console.log(`   Username: ${existingSuperAdmin[0].username}`);
      console.log(`   Email: ${existingSuperAdmin[0].email}`);
      console.log(`   Role: ${existingSuperAdmin[0].role}\n`);
      return;
    }

    // Get or create a dealership
    let dealershipId = null;
    const existingDealerships = await db.select().from(dealerships).limit(1);

    if (existingDealerships.length === 0) {
      console.log("Creating default dealership...");
      const newDealership = await db
        .insert(dealerships)
        .values({
          name: "Rylie AI Platform",
          subdomain: "platform",
          contactEmail: "admin@rylie.ai",
          contactPhone: "555-0000",
          address: "123 AI Street",
          city: "Tech City",
          state: "CA",
          zip: "90210",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      dealershipId = newDealership[0].id;
      console.log(`   Created dealership with ID: ${dealershipId}`);
    } else {
      dealershipId = existingDealerships[0].id;
      console.log(`   Using existing dealership ID: ${dealershipId}`);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create super admin user
    console.log("Creating super admin user...");
    const newUser = await db
      .insert(users)
      .values({
        username: "superadmin",
        email: "superadmin@rylie.ai",
        password: hashedPassword,
        role: "super_admin",
        dealershipId: dealershipId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✅ Super admin user created successfully!");
    console.log("📋 Login Credentials:");
    console.log("   Username: superadmin");
    console.log("   Password: admin123");
    console.log("   Role: super_admin\n");

    console.log("🔑 You can now access admin routes with these credentials.");
  } catch (error) {
    console.error("❌ Failed to create super admin:", error);
  }
}

createSuperAdmin();
