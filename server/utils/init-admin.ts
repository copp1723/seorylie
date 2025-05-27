import { db } from '../db';
import { users, dealerships } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import logger from './logger';

export async function initializeDefaultUser() {
  try {
    // Check if any admin user exists
    const existingAdmins = await db.select()
      .from(users)
      .where(eq(users.role, 'super_admin'))
      .limit(1);

    if (existingAdmins.length > 0) {
      logger.info('Admin user already exists, skipping initialization');
      return;
    }

    // Create a default dealership if none exists
    let dealershipId = null;
    const existingDealerships = await db.select()
      .from(dealerships)
      .limit(1);

    if (existingDealerships.length === 0) {
      logger.info('Creating default dealership...');
      const newDealership = await db.insert(dealerships).values({
        name: 'Default Dealership',
        subdomain: 'default',
        contact_email: 'contact@defaultdealership.com',
        contact_phone: '555-0123',
        address: '123 Main St',
        city: 'Default City',
        state: 'CA',
        zip: '12345',
        website: 'https://defaultdealership.com',
        created_at: new Date(),
        updated_at: new Date(),
      }).returning();

      dealershipId = newDealership[0].id;
      logger.info(`Created default dealership with ID: ${dealershipId}`);
    } else {
      dealershipId = existingDealerships[0].id;
    }

    // Hash the default password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create default admin user
    logger.info('Creating default admin user...');
    await db.insert(users).values({
      username: 'admin',
      email: 'admin@rylie.ai',
      password: hashedPassword,
      name: 'Default Admin',
      role: 'super_admin',
      dealership_id: dealershipId,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info('Default admin user created successfully!');
    logger.info('Login credentials: admin / admin123');

  } catch (error) {
    logger.error('Failed to initialize default admin user:', error);
    // Don't throw error to prevent server startup failure
  }
}
