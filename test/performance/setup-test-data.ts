#!/usr/bin/env tsx

import db from "../../server/db";
import {
  dealerships,
  users,
  vehicles,
  conversations,
  messages,
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import logger from "../../server/utils/logger";

interface TestDataConfig {
  dealerships: number;
  usersPerDealership: number;
  vehiclesPerDealership: number;
  conversationsPerDealership: number;
  messagesPerConversation: number;
}

class TestDataSetup {
  private config: TestDataConfig = {
    dealerships: 3,
    usersPerDealership: 5,
    vehiclesPerDealership: 100,
    conversationsPerDealership: 50,
    messagesPerConversation: 10,
  };

  async setupTestData(): Promise<void> {
    console.log("🔧 Setting up test data for performance testing...");
    console.log("Configuration:", this.config);

    try {
      // Clean existing test data
      await this.cleanTestData();

      // Create test dealerships
      const testDealerships = await this.createTestDealerships();

      // Create test users for each dealership
      await this.createTestUsers(testDealerships);

      // Create test vehicles for each dealership
      await this.createTestVehicles(testDealerships);

      // Create test conversations and messages
      await this.createTestConversations(testDealerships);

      console.log("✅ Test data setup completed successfully!");
    } catch (error) {
      console.error("❌ Failed to setup test data:", error);
      throw error;
    }
  }

  private async cleanTestData(): Promise<void> {
    console.log("🧹 Cleaning existing test data...");

    try {
      // Delete test data (be careful with this in production!)
      await db.delete(messages).where(eq(messages.content, "TEST_MESSAGE"));
      await db
        .delete(conversations)
        .where(eq(conversations.subject, "Test Conversation"));
      await db.delete(vehicles).where(eq(vehicles.make, "TEST_MAKE"));
      await db.delete(users).where(eq(users.username, "testuser1"));
      await db.delete(users).where(eq(users.username, "testuser2"));
      await db.delete(users).where(eq(users.username, "testuser3"));
      await db
        .delete(dealerships)
        .where(eq(dealerships.subdomain, "test-dealership-1"));
      await db
        .delete(dealerships)
        .where(eq(dealerships.subdomain, "test-dealership-2"));
      await db
        .delete(dealerships)
        .where(eq(dealerships.subdomain, "test-dealership-3"));

      console.log("✅ Cleaned existing test data");
    } catch (error) {
      console.warn("⚠️ Warning during cleanup (may be expected):", error);
    }
  }

  private async createTestDealerships(): Promise<any[]> {
    console.log("🏢 Creating test dealerships...");

    const testDealerships = [];

    for (let i = 1; i <= this.config.dealerships; i++) {
      const dealership = {
        name: `Test Dealership ${i}`,
        subdomain: `test-dealership-${i}`,
        contact_email: `test${i}@testdealership.com`,
        contact_phone: `555-000-000${i}`,
        address: `${i}00 Test Street`,
        city: "Test City",
        state: "TS",
        zip: `1000${i}`,
        website: `https://test-dealership-${i}.com`,
        description: `Test dealership ${i} for performance testing`,
        mode: "ai_only" as const,
        status: "active" as const,
        ai_config: {
          ai_personality: "friendly and helpful",
          response_delay_ms: 1000,
          escalation_triggers: ["human agent", "speak to manager"],
        },
      };

      const [created] = await db
        .insert(dealerships)
        .values(dealership)
        .returning();
      testDealerships.push(created);

      console.log(`✅ Created dealership: ${dealership.name}`);
    }

    return testDealerships;
  }

  private async createTestUsers(testDealerships: any[]): Promise<void> {
    console.log("👥 Creating test users...");

    const hashedPassword = await bcrypt.hash("testpass123", 10);

    for (const dealership of testDealerships) {
      for (let i = 1; i <= this.config.usersPerDealership; i++) {
        const user = {
          username: `testuser${i}`,
          email: `testuser${i}@${dealership.subdomain}.com`,
          password: hashedPassword,
          first_name: `Test`,
          last_name: `User ${i}`,
          role: i === 1 ? ("admin" as const) : ("agent" as const),
          dealership_id: dealership.id,
          status: "active" as const,
          phone: `555-${dealership.id}00-${i.toString().padStart(3, "0")}`,
        };

        await db.insert(users).values(user);
        console.log(`✅ Created user: ${user.username} for ${dealership.name}`);
      }
    }
  }

  private async createTestVehicles(testDealerships: any[]): Promise<void> {
    console.log("🚗 Creating test vehicles...");

    const makes = [
      "Toyota",
      "Honda",
      "Ford",
      "Chevrolet",
      "Nissan",
      "BMW",
      "Mercedes",
      "Audi",
    ];
    const models = [
      "Sedan",
      "SUV",
      "Truck",
      "Coupe",
      "Hatchback",
      "Convertible",
    ];
    const conditions = ["new", "used", "certified"];
    const colors = ["Black", "White", "Silver", "Red", "Blue", "Gray", "Green"];

    for (const dealership of testDealerships) {
      console.log(`Creating vehicles for ${dealership.name}...`);

      const vehicleBatch = [];

      for (let i = 1; i <= this.config.vehiclesPerDealership; i++) {
        const make = makes[Math.floor(Math.random() * makes.length)];
        const model = models[Math.floor(Math.random() * models.length)];
        const year = 2018 + Math.floor(Math.random() * 7); // 2018-2024
        const condition =
          conditions[Math.floor(Math.random() * conditions.length)];

        const vehicle = {
          make,
          model,
          year,
          vin: `TEST${dealership.id}${i.toString().padStart(10, "0")}`,
          price: 15000 + Math.floor(Math.random() * 50000),
          condition,
          mileage: condition === "new" ? 0 : Math.floor(Math.random() * 100000),
          color: colors[Math.floor(Math.random() * colors.length)],
          transmission: Math.random() > 0.2 ? "Automatic" : "Manual",
          fuel_type: Math.random() > 0.3 ? "Gasoline" : "Hybrid",
          body_style: model,
          engine: `${(Math.random() * 3 + 1).toFixed(1)}L V${Math.random() > 0.5 ? "6" : "4"}`,
          drivetrain: Math.random() > 0.6 ? "AWD" : "FWD",
          status: "available",
          dealership_id: dealership.id,
          description: `Test ${make} ${model} for performance testing`,
          features: ["Air Conditioning", "Bluetooth", "Backup Camera"],
          images: [`https://example.com/vehicle-${i}.jpg`],
        };

        vehicleBatch.push(vehicle);

        // Insert in batches of 20 for better performance
        if (vehicleBatch.length === 20) {
          await db.insert(vehicles).values(vehicleBatch);
          vehicleBatch.length = 0;
        }
      }

      // Insert remaining vehicles
      if (vehicleBatch.length > 0) {
        await db.insert(vehicles).values(vehicleBatch);
      }

      console.log(
        `✅ Created ${this.config.vehiclesPerDealership} vehicles for ${dealership.name}`,
      );
    }
  }

  private async createTestConversations(testDealerships: any[]): Promise<void> {
    console.log("💬 Creating test conversations and messages...");

    const sampleMessages = [
      "Hello, I'm interested in your vehicles",
      "Do you have any Toyota Camry available?",
      "What's the price range for used cars?",
      "Can I schedule a test drive?",
      "What financing options do you offer?",
      "I'm looking for a reliable family car",
      "Do you accept trade-ins?",
      "What's your warranty policy?",
      "Can you tell me about this vehicle's history?",
      "I'd like to speak with a sales representative",
    ];

    for (const dealership of testDealerships) {
      console.log(`Creating conversations for ${dealership.name}...`);

      for (let i = 1; i <= this.config.conversationsPerDealership; i++) {
        // Create conversation
        const conversation = {
          dealership_id: dealership.id,
          customer_name: `Test Customer ${i}`,
          customer_email: `customer${i}@test.com`,
          customer_phone: `555-${dealership.id}${i.toString().padStart(2, "0")}-0000`,
          subject: "Test Conversation",
          status: Math.random() > 0.7 ? "closed" : "active",
          priority: Math.random() > 0.8 ? "high" : "normal",
          source: "website",
          metadata: {
            test_data: true,
            created_for: "performance_testing",
          },
        };

        const [createdConversation] = await db
          .insert(conversations)
          .values(conversation)
          .returning();

        // Create messages for this conversation
        for (let j = 1; j <= this.config.messagesPerConversation; j++) {
          const message = {
            conversation_id: createdConversation.id,
            sender_type: j % 2 === 1 ? "customer" : "agent",
            sender_name:
              j % 2 === 1 ? conversation.customer_name : "AI Assistant",
            content:
              sampleMessages[Math.floor(Math.random() * sampleMessages.length)],
            message_type: "text",
            metadata: {
              test_message: true,
              message_number: j,
            },
          };

          await db.insert(messages).values(message);
        }
      }

      console.log(
        `✅ Created ${this.config.conversationsPerDealership} conversations for ${dealership.name}`,
      );
    }
  }

  async cleanupTestData(): Promise<void> {
    console.log("🧹 Cleaning up test data...");
    await this.cleanTestData();
    console.log("✅ Test data cleanup completed");
  }

  async verifyTestData(): Promise<void> {
    console.log("🔍 Verifying test data...");

    try {
      const dealershipCount = await db
        .select()
        .from(dealerships)
        .where(eq(dealerships.name, "Test Dealership 1"));
      const userCount = await db
        .select()
        .from(users)
        .where(eq(users.username, "testuser1"));
      const vehicleCount = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.make, "Toyota"));

      console.log(`Dealerships: ${dealershipCount.length}`);
      console.log(`Users: ${userCount.length}`);
      console.log(`Vehicles: ${vehicleCount.length}`);

      console.log("✅ Test data verification completed");
    } catch (error) {
      console.error("❌ Test data verification failed:", error);
    }
  }
}

// Main execution
const setup = new TestDataSetup();

const command = process.argv[2];

switch (command) {
  case "setup":
    setup.setupTestData().catch(console.error);
    break;
  case "cleanup":
    setup.cleanupTestData().catch(console.error);
    break;
  case "verify":
    setup.verifyTestData().catch(console.error);
    break;
  default:
    console.log("Usage: tsx setup-test-data.ts [setup|cleanup|verify]");
    break;
}

export default TestDataSetup;
