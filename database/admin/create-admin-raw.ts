#!/usr/bin/env tsx

import postgres from "postgres";

async function createAdminRaw() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  try {
    console.log("🔐 Creating admin user via raw SQL...\n");

    // First check if admin exists
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

    // Create dealership if doesn't exist
    console.log("Creating dealership...");
    await sql`
      INSERT INTO dealerships (name, subdomain, contact_email, contact_phone, address, city, state, zip, created_at, updated_at)
      VALUES ('Alpha Dealership', 'alpha', 'admin@alpha.ai', '555-0000', '123 Main Street', 'Demo City', 'CA', '90210', NOW(), NOW())
      ON CONFLICT (subdomain) DO NOTHING
    `;

    // Get dealership ID
    const dealership = await sql`
      SELECT id FROM dealerships WHERE subdomain = 'alpha' LIMIT 1
    `;
    const dealershipId = dealership[0].id;
    console.log(`   Using dealership ID: ${dealershipId}`);

    // Create admin user with bcrypt hash for "admin123"
    console.log("Creating admin user...");
    await sql`
      INSERT INTO users (username, email, password, role, dealership_id, created_at, updated_at)
      VALUES (
        'admin', 
        'admin@alpha.ai', 
        '$2b$10$rQJ8Kx/4QK5oYa1dZ9LF3OGmb1Zb0yZz3QW3CmK5H1RYcH8MkwjY6',
        'super_admin', 
        ${dealershipId}, 
        NOW(), 
        NOW()
      )
      ON CONFLICT (email) DO NOTHING
    `;

    console.log("✅ Admin user created successfully!");
    console.log("📋 Login Credentials:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   Role: super_admin\n");

    console.log("🌐 To access the admin dashboard:");
    console.log("   1. Start the application: npm run dev");
    console.log("   2. Go to: http://localhost:3000");
    console.log("   3. Login with credentials above");
    console.log("   4. Navigate to: Admin > Dealerships");
    console.log(
      '   5. Click "Add Dealership" to create your first alpha dealership\n',
    );
  } catch (error) {
    console.error("❌ Failed to create admin:", error);
  } finally {
    await sql.end();
  }
}

createAdminRaw();
