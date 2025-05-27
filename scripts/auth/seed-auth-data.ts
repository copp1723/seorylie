#!/usr/bin/env tsx

import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { dealerships, users } from '../shared/schema';
import { logger } from '../server/logger';
import { eq } from 'drizzle-orm';

/**
 * Seed script to create test data for authentication
 */

async function seedAuthData() {
  try {
    logger.info('Starting authentication data seeding...');

    // Create a test dealership
    logger.info('Creating test dealership...');
    const testDealership = await db.insert(dealerships).values({
      name: 'Test Motors',
      subdomain: 'test-motors',
      contact_email: 'contact@testmotors.com',
      contact_phone: '(555) 123-4567',
      address: '123 Main Street',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      website: 'https://testmotors.com',
      description: 'Your trusted local car dealership',
      persona_name: 'Rylie',
      persona_tone: 'friendly',
      welcome_message: 'Welcome to Test Motors! How can I help you find your perfect vehicle today?',
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning({ id: dealerships.id });

    const dealershipId = testDealership[0].id;
    logger.info(`Created dealership with ID: ${dealershipId}`);

    // Hash password for test users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create test users
    logger.info('Creating test users...');

    // Admin user
    await db.insert(users).values({
      username: 'admin',
      email: 'admin@testmotors.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'super_admin',
      dealership_id: dealershipId,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Manager user
    await db.insert(users).values({
      username: 'manager',
      email: 'manager@testmotors.com',
      password: hashedPassword,
      name: 'Manager User',
      role: 'manager',
      dealership_id: dealershipId,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Regular user
    await db.insert(users).values({
      username: 'user',
      email: 'user@testmotors.com',
      password: hashedPassword,
      name: 'Regular User',
      role: 'user',
      dealership_id: dealershipId,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // User without dealership (for testing)
    await db.insert(users).values({
      username: 'freelance',
      email: 'freelance@example.com',
      password: hashedPassword,
      name: 'Freelance User',
      role: 'user',
      dealership_id: null,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info('Test users created successfully!');
    logger.info('Test credentials:');
    logger.info('  Admin: admin@testmotors.com / password123');
    logger.info('  Manager: manager@testmotors.com / password123');
    logger.info('  User: user@testmotors.com / password123');
    logger.info('  Freelance: freelance@example.com / password123');

    logger.info('Authentication data seeding completed successfully!');

  } catch (error) {
    logger.error('Error during authentication data seeding:', error);
    throw error;
  }
}

// Run the seeding if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAuthData()
    .then(() => {
      logger.info('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedAuthData };
