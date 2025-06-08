#!/usr/bin/env node

/**
 * Database Seed Script
 *
 * This script populates the database with development data including:
 * - Sample dealerships
 * - Test users with different roles
 * - Sample personas
 * - Example leads and conversations
 * - API keys for testing
 */

import { Client } from "pg";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";

// Configuration
const DB_CONNECTION = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "cleanrylie",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

class DatabaseSeeder {
  private client: Client;

  constructor() {
    this.client = new Client(DB_CONNECTION);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log(`${colors.green}✓${colors.reset} Connected to database`);
    } catch (error) {
      console.error(
        `${colors.red}✗${colors.reset} Failed to connect to database:`,
        error,
      );
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  /**
   * Clear existing seed data
   */
  async clearData(): Promise<void> {
    console.log(
      `${colors.yellow}→${colors.reset} Clearing existing seed data...`,
    );

    const tables = [
      "conversation_messages",
      "conversations",
      "adf_sms_responses",
      "adf_processing_logs",
      "adf_email_queue",
      "adf_leads",
      "leads",
      "customers",
      "api_keys",
      "personas",
      "users",
      "dealerships",
    ];

    for (const table of tables) {
      try {
        await this.client.query(
          `DELETE FROM ${table} WHERE created_at > NOW() - INTERVAL '1 day' OR id > 1000`,
        );
      } catch (error) {
        // Table might not exist, that's OK
        console.log(
          `${colors.blue}ℹ${colors.reset} Skipped ${table} (table not found)`,
        );
      }
    }

    console.log(`${colors.green}✓${colors.reset} Cleared existing seed data`);
  }

  /**
   * Seed dealerships
   */
  async seedDealerships(): Promise<number[]> {
    console.log(`${colors.yellow}→${colors.reset} Seeding dealerships...`);

    const dealerships = [
      {
        name: "Premier Auto Group",
        subdomain: "premier-auto",
        contactEmail: "info@premierauto.com",
        contactPhone: "(555) 123-4567",
        address: "123 Auto Plaza Dr",
        city: "Austin",
        state: "TX",
        zip: "78701",
        timezone: "America/Chicago",
      },
      {
        name: "Coastal Motors",
        subdomain: "coastal-motors",
        contactEmail: "sales@coastalmotors.com",
        contactPhone: "(555) 987-6543",
        address: "456 Highway 1",
        city: "San Diego",
        state: "CA",
        zip: "92101",
        timezone: "America/Los_Angeles",
      },
      {
        name: "Metro Car Center",
        subdomain: "metro-cars",
        contactEmail: "contact@metrocars.com",
        contactPhone: "(555) 456-7890",
        address: "789 Main Street",
        city: "New York",
        state: "NY",
        zip: "10001",
        timezone: "America/New_York",
      },
    ];

    const dealershipIds: number[] = [];

    for (const dealership of dealerships) {
      const result = await this.client.query(
        `
        INSERT INTO dealerships (name, subdomain, contact_email, contact_phone, address, city, state, zip, timezone, settings)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
        [
          dealership.name,
          dealership.subdomain,
          dealership.contactEmail,
          dealership.contactPhone,
          dealership.address,
          dealership.city,
          dealership.state,
          dealership.zip,
          dealership.timezone,
          JSON.stringify({
            autoEscalationEnabled: true,
            autoEscalationThreshold: 3,
            businessHours: {
              monday: { open: "09:00", close: "18:00" },
              tuesday: { open: "09:00", close: "18:00" },
              wednesday: { open: "09:00", close: "18:00" },
              thursday: { open: "09:00", close: "18:00" },
              friday: { open: "09:00", close: "18:00" },
              saturday: { open: "09:00", close: "17:00" },
              sunday: { open: "11:00", close: "16:00" },
            },
          }),
        ],
      );

      dealershipIds.push(result.rows[0].id);
    }

    console.log(
      `${colors.green}✓${colors.reset} Created ${dealerships.length} dealerships`,
    );
    return dealershipIds;
  }

  /**
   * Seed users
   */
  async seedUsers(dealershipIds: number[]): Promise<number[]> {
    console.log(`${colors.yellow}→${colors.reset} Seeding users...`);

    const users = [
      {
        username: "admin",
        email: "admin@cleanrylie.com",
        password: "admin123",
        role: "admin",
        dealershipId: null,
      },
      {
        username: "manager1",
        email: "manager@premierauto.com",
        password: "manager123",
        role: "manager",
        dealershipId: dealershipIds[0],
      },
      {
        username: "agent1",
        email: "agent1@premierauto.com",
        password: "agent123",
        role: "agent",
        dealershipId: dealershipIds[0],
      },
      {
        username: "agent2",
        email: "agent2@premierauto.com",
        password: "agent123",
        role: "agent",
        dealershipId: dealershipIds[0],
      },
      {
        username: "manager2",
        email: "manager@coastalmotors.com",
        password: "manager123",
        role: "manager",
        dealershipId: dealershipIds[1],
      },
    ];

    const userIds: number[] = [];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const result = await this.client.query(
        `
        INSERT INTO users (username, email, password, role, dealership_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
        [
          user.username,
          user.email,
          hashedPassword,
          user.role,
          user.dealershipId,
        ],
      );

      userIds.push(result.rows[0].id);
    }

    console.log(
      `${colors.green}✓${colors.reset} Created ${users.length} users`,
    );
    return userIds;
  }

  /**
   * Seed personas
   */
  async seedPersonas(dealershipIds: number[]): Promise<void> {
    console.log(`${colors.yellow}→${colors.reset} Seeding personas...`);

    const personas = [
      {
        name: "Rylie - Professional",
        description:
          "Professional and knowledgeable automotive sales assistant",
        dealershipId: dealershipIds[0],
        isDefault: true,
        promptTemplate: `You are Rylie, a professional AI sales assistant for {{dealershipName}}. You help customers find the perfect vehicle by understanding their needs, providing detailed information about our inventory, and guiding them through the buying process.

Key traits:
- Professional yet friendly
- Knowledgeable about automotive features and financing
- Focused on customer satisfaction
- Always willing to escalate to human agents when needed

Always mention relevant features like {{priorityFeatures}} when appropriate.`,
        arguments: JSON.stringify({
          tone: "professional",
          priorityFeatures: [
            "Safety Features",
            "Fuel Efficiency",
            "Technology Package",
          ],
          handoverEmail: "sales@premierauto.com",
        }),
      },
      {
        name: "Rylie - Luxury",
        description: "Sophisticated assistant for luxury vehicle sales",
        dealershipId: dealershipIds[1],
        isDefault: true,
        promptTemplate: `You are Rylie, a sophisticated AI concierge for {{dealershipName}}'s luxury automotive division. You provide white-glove service to discerning customers seeking premium vehicles.

Key traits:
- Sophisticated and refined communication
- Deep knowledge of luxury features and craftsmanship
- Understanding of premium customer service expectations
- Emphasis on exclusivity and prestige

Focus on premium features like {{priorityFeatures}} and provide exceptional service.`,
        arguments: JSON.stringify({
          tone: "luxury",
          priorityFeatures: [
            "Premium Interior",
            "Advanced Technology",
            "Performance Package",
          ],
          handoverEmail: "luxury@coastalmotors.com",
        }),
      },
      {
        name: "Rylie - Friendly",
        description: "Casual and approachable assistant for everyday customers",
        dealershipId: dealershipIds[2],
        isDefault: true,
        promptTemplate: `You are Rylie, a friendly and approachable AI assistant for {{dealershipName}}. You make car buying easy and stress-free for everyday customers and families.

Key traits:
- Warm and conversational
- Patient with questions
- Focused on value and practicality
- Understanding of budget considerations

Highlight practical features like {{priorityFeatures}} that matter to families.`,
        arguments: JSON.stringify({
          tone: "friendly",
          priorityFeatures: [
            "Reliability",
            "Spacious Interior",
            "Warranty Coverage",
          ],
          handoverEmail: "sales@metrocars.com",
        }),
      },
    ];

    for (const persona of personas) {
      await this.client.query(
        `
        INSERT INTO personas (name, description, dealership_id, is_default, prompt_template, arguments)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          persona.name,
          persona.description,
          persona.dealershipId,
          persona.isDefault,
          persona.promptTemplate,
          persona.arguments,
        ],
      );
    }

    console.log(
      `${colors.green}✓${colors.reset} Created ${personas.length} personas`,
    );
  }

  /**
   * Seed API keys
   */
  async seedApiKeys(dealershipIds: number[]): Promise<void> {
    console.log(`${colors.yellow}→${colors.reset} Seeding API keys...`);

    const apiKeys = dealershipIds.map((dealershipId, index) => ({
      dealershipId,
      name: `Production API Key - Dealership ${index + 1}`,
      keyHash: createHash("sha256")
        .update(`test_key_${dealershipId}_${Date.now()}`)
        .digest("hex"),
      keyPrefix: `ryk_${randomBytes(8).toString("hex")}`,
      permissions: JSON.stringify(["read", "write", "admin"]),
      rateLimitRpm: 1000,
      isActive: true,
    }));

    for (const apiKey of apiKeys) {
      await this.client.query(
        `
        INSERT INTO api_keys (dealership_id, name, key_hash, key_prefix, permissions, rate_limit_rpm, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [
          apiKey.dealershipId,
          apiKey.name,
          apiKey.keyHash,
          apiKey.keyPrefix,
          apiKey.permissions,
          apiKey.rateLimitRpm,
          apiKey.isActive,
        ],
      );
    }

    console.log(
      `${colors.green}✓${colors.reset} Created ${apiKeys.length} API keys`,
    );
  }

  /**
   * Seed sample customers and leads
   */
  async seedCustomersAndLeads(dealershipIds: number[]): Promise<void> {
    console.log(
      `${colors.yellow}→${colors.reset} Seeding customers and leads...`,
    );

    for (const dealershipId of dealershipIds) {
      // Create 10 customers per dealership
      for (let i = 0; i < 10; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const email = faker.internet.email({ firstName, lastName });
        const phone = faker.phone.number();

        // Create customer
        const customerResult = await this.client.query(
          `
          INSERT INTO customers (dealership_id, first_name, last_name, email, phone, full_name)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
          [
            dealershipId,
            firstName,
            lastName,
            email,
            phone,
            `${firstName} ${lastName}`,
          ],
        );

        const customerId = customerResult.rows[0].id;

        // Create lead
        const leadResult = await this.client.query(
          `
          INSERT INTO leads (dealership_id, customer_id, status, source, description, lead_score)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
          [
            dealershipId,
            customerId,
            faker.helpers.arrayElement([
              "new",
              "contacted",
              "qualified",
              "proposal",
            ]),
            faker.helpers.arrayElement([
              "website_form",
              "phone_call",
              "referral",
              "advertising",
            ]),
            faker.lorem.sentence(),
            faker.number.int({ min: 1, max: 100 }),
          ],
        );

        const leadId = leadResult.rows[0].id;

        // Create conversation
        const conversationResult = await this.client.query(
          `
          INSERT INTO conversations (dealership_id, customer_id, subject, status, channel)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
          [
            dealershipId,
            customerId,
            faker.lorem.words(3),
            faker.helpers.arrayElement(["open", "active", "waiting_response"]),
            faker.helpers.arrayElement(["web", "email", "sms"]),
          ],
        );

        const conversationId = conversationResult.rows[0].id;

        // Create some messages
        const messageCount = faker.number.int({ min: 2, max: 8 });
        for (let j = 0; j < messageCount; j++) {
          await this.client.query(
            `
            INSERT INTO conversation_messages (conversation_id, content, role, created_at)
            VALUES ($1, $2, $3, $4)
          `,
            [
              conversationId,
              faker.lorem.paragraph(),
              faker.helpers.arrayElement(["customer", "ai", "agent"]),
              faker.date.recent({ days: 7 }),
            ],
          );
        }
      }
    }

    console.log(
      `${colors.green}✓${colors.reset} Created customers, leads, and conversations`,
    );
  }

  /**
   * Seed sample ADF leads
   */
  async seedAdfLeads(dealershipIds: number[]): Promise<void> {
    console.log(`${colors.yellow}→${colors.reset} Seeding ADF leads...`);

    for (const dealershipId of dealershipIds) {
      // Create 5 ADF leads per dealership
      for (let i = 0; i < 5; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const email = faker.internet.email({ firstName, lastName });
        const phone = faker.phone.number();

        await this.client.query(
          `
          INSERT INTO adf_leads (
            dealership_id, request_type, status, first_name, last_name, email, phone,
            vehicle_of_interest, vehicle_year, vehicle_make, vehicle_model,
            source, deduplication_hash, lead_score
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `,
          [
            dealershipId,
            faker.helpers.arrayElement([
              "new_vehicle",
              "used_vehicle",
              "service",
              "financing",
            ]),
            faker.helpers.arrayElement(["new", "processing", "processed"]),
            firstName,
            lastName,
            email,
            phone,
            faker.vehicle.vehicle(),
            faker.date.recent().getFullYear(),
            faker.vehicle.manufacturer(),
            faker.vehicle.model(),
            "dealer_website",
            createHash("sha256")
              .update(`${email}${phone}${Date.now()}`)
              .digest("hex"),
            faker.number.int({ min: 1, max: 100 }),
          ],
        );
      }
    }

    console.log(`${colors.green}✓${colors.reset} Created ADF leads`);
  }

  /**
   * Run all seeding operations
   */
  async seedAll(): Promise<void> {
    console.log(
      `${colors.bold}🌱 Starting database seeding...${colors.reset}\n`,
    );

    try {
      await this.clearData();

      const dealershipIds = await this.seedDealerships();
      const userIds = await this.seedUsers(dealershipIds);

      await this.seedPersonas(dealershipIds);
      await this.seedApiKeys(dealershipIds);
      await this.seedCustomersAndLeads(dealershipIds);
      await this.seedAdfLeads(dealershipIds);

      console.log(
        `\n${colors.green}✓${colors.reset} Database seeding completed successfully!`,
      );
      console.log(`\n${colors.blue}📊 Summary:${colors.reset}`);
      console.log(`  • ${dealershipIds.length} dealerships created`);
      console.log(`  • ${userIds.length} users created`);
      console.log(`  • 3 personas created`);
      console.log(`  • ${dealershipIds.length} API keys created`);
      console.log(
        `  • ${dealershipIds.length * 10} customers and leads created`,
      );
      console.log(`  • ${dealershipIds.length * 5} ADF leads created`);

      console.log(`\n${colors.yellow}🔑 Test Credentials:${colors.reset}`);
      console.log("  Admin: admin@cleanrylie.com / admin123");
      console.log("  Manager: manager@premierauto.com / manager123");
      console.log("  Agent: agent1@premierauto.com / agent123");
    } catch (error) {
      console.error(`${colors.red}✗${colors.reset} Seeding failed:`, error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const seeder = new DatabaseSeeder();

  try {
    await seeder.connect();
    await seeder.seedAll();
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Seeding failed:`, error);
    process.exit(1);
  } finally {
    await seeder.disconnect();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DatabaseSeeder };
