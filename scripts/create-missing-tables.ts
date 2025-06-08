#!/usr/bin/env tsx

import { config } from "dotenv";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import logger from "../server/utils/logger";

// Load environment variables
config();

async function createMissingTables() {
  try {
    logger.info("Creating missing tables for migration compatibility...");

    // Create personas table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        prompt_template TEXT NOT NULL,
        arguments JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes for personas
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_personas_dealership ON personas(dealership_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_personas_default ON personas(is_default);
    `);

    logger.info("Personas table created");

    // Create api_keys table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key VARCHAR(255) NOT NULL UNIQUE,
        service VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes for api_keys
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_dealership ON api_keys(dealership_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    `);

    logger.info("API keys table created");

    // Create vehicles table (basic structure)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        vin VARCHAR(17) UNIQUE,
        year INTEGER,
        make VARCHAR(100),
        model VARCHAR(100),
        trim VARCHAR(100),
        body_style VARCHAR(100),
        condition VARCHAR(20) CHECK (condition IN ('new', 'used', 'cpo')),
        price INTEGER, -- in cents
        mileage INTEGER,
        stock_number VARCHAR(50),
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes for vehicles
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_vehicles_dealership ON vehicles(dealership_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
    `);

    logger.info("Vehicles table created");

    // Insert default persona for existing dealerships
    const dealerships = await db.execute(sql`
      SELECT id FROM dealerships;
    `);

    for (const dealership of dealerships) {
      const existingPersona = await db.execute(sql`
        SELECT id FROM personas WHERE dealership_id = ${dealership.id} LIMIT 1;
      `);

      if (existingPersona.length === 0) {
        const promptTemplate = `You are a professional automotive sales assistant for our dealership. Your role is to help customers find the perfect vehicle while providing exceptional service.

GUIDELINES:
- Be friendly, professional, and knowledgeable
- Ask relevant questions to understand customer needs
- Provide accurate information about vehicles and services
- Guide customers toward scheduling appointments or test drives
- Escalate complex questions to human sales representatives

INFORMATION TO COLLECT:
- Vehicle preferences (type, features, budget)
- Timeline for purchase
- Trade-in information
- Financing needs

Always remember to personalize your responses and maintain a helpful, consultative approach.`;

        const personaArgs = JSON.stringify({
          tone: "professional",
          priorityFeatures: ["Safety", "Fuel Efficiency", "Technology"],
          handoverEmail: "sales@dealership.com",
        });

        await db.execute(sql`
          INSERT INTO personas (dealership_id, name, prompt_template, arguments, is_default)
          VALUES (${dealership.id}, 'Default Sales Assistant', ${promptTemplate}, ${personaArgs}::jsonb, true);
        `);

        logger.info(`Created default persona for dealership ${dealership.id}`);
      }
    }

    logger.info("Missing tables created successfully");
  } catch (error) {
    logger.error("Error creating missing tables:", error);
    throw error;
  }
}

// Run the setup
createMissingTables()
  .then(() => {
    logger.info("Missing tables setup completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Missing tables setup failed:", error);
    process.exit(1);
  });
