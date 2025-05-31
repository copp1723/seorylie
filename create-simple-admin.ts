#!/usr/bin/env tsx

import { db } from './server/db.js';
import { users, dealerships } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function createSimpleAdmin() {
  console.log('🔐 Creating Simple Admin User...\n');

  try {
    // Check if admin already exists
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.role, 'super_admin'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin already exists:');
      console.log(`   Username: ${existingAdmin[0].username}`);
      console.log(`   Email: ${existingAdmin[0].email}`);
      console.log(`   Role: ${existingAdmin[0].role}\n`);
      return;
    }

    // Get or create a dealership
    let dealershipId = null;
    const existingDealerships = await db.select().from(dealerships).limit(1);

    if (existingDealerships.length === 0) {
      console.log('Creating default dealership...');
      const newDealership = await db.insert(dealerships).values({
        name: 'Alpha Dealership',
        subdomain: 'alpha',
        contactEmail: 'admin@alpha.ai',
        contactPhone: '555-0000',
        address: '123 Main Street',
        city: 'Demo City',
        state: 'CA',
        zip: '90210',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      dealershipId = newDealership[0].id;
      console.log(`   Created dealership with ID: ${dealershipId}`);
    } else {
      dealershipId = existingDealerships[0].id;
      console.log(`   Using existing dealership ID: ${dealershipId}`);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user (without is_active field to avoid schema conflicts)
    console.log('Creating admin user...');
    const newUser = await db.insert(users).values({
      username: 'admin',
      email: 'admin@alpha.ai',
      password: hashedPassword,
      role: 'super_admin',
      dealershipId: dealershipId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log('📋 Login Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: super_admin\n');

    console.log('🌐 To access the admin dashboard:');
    console.log('   1. Start the application');
    console.log('   2. Go to http://localhost:3000');
    console.log('   3. Login with the credentials above');
    console.log('   4. Navigate to Admin > Dealerships\n');

  } catch (error) {
    console.error('❌ Failed to create admin:', error);
  }
}

createSimpleAdmin();