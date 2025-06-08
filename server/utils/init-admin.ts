import { db } from "../db";
import { users, dealerships } from "../../shared/index";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import logger from "./logger";

export async function initializeDefaultUser() {
  try {
    // Check if any admin user exists
    const existingAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, "super_admin"))
      .limit(1);

    if (existingAdmins.length > 0) {
      logger.info("Admin user already exists, skipping initialization");
      return;
    }

    // Create a default dealership if none exists
    let dealershipId = null;
    const existingDealerships = await db.select().from(dealerships).limit(1);

    if (existingDealerships.length === 0) {
      logger.info("Creating default dealership...");
      const newDealership = await db
        .insert(dealerships)
        .values({
          name: "Default Dealership",
          subdomain: "default",
          contactEmail: "contact@defaultdealership.com",
          contactPhone: "555-0123",
          address: "123 Main St",
          city: "Default City",
          state: "CA",
          zip: "12345",
        })
        .returning();

      dealershipId = newDealership[0]?.id ?? null;
      logger.info(`Created default dealership with ID: ${dealershipId}`);
    } else {
      dealershipId = existingDealerships[0]?.id ?? null;
    }

    if (!dealershipId) {
      throw new Error("Failed to create or find dealership");
    }

    // Hash the default password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create default admin user
    logger.info("Creating default admin user...");
    await db.insert(users).values({
      username: "admin",
      email: "admin@rylie.ai",
      password: hashedPassword,
      role: "super_admin",
      dealershipId: dealershipId,
      isActive: true,
    });

    logger.info("Default admin user created successfully!");
    logger.info("Login credentials: admin / admin123");
  } catch (error) {
    logger.error("Failed to initialize default admin user:", error);
    // Don't throw error to prevent server startup failure
  }
}
