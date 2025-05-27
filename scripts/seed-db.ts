import { db } from "../server/db";
import { users, dealerships, vehicles, personas, apiKeys } from "../shared/schema";
import { randomBytes } from "crypto";

// Seed function to populate the database with initial test data
async function seedDatabase() {
  console.log("Starting database seed...");

  try {
    // Create test users
    console.log("Creating users...");
    const [adminUser] = await db.insert(users).values({
      username: "admin",
      password: "admin123", // In production, this would be hashed
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    }).returning();

    const [managerUser] = await db.insert(users).values({
      username: "manager",
      password: "manager123", // In production, this would be hashed
      name: "Manager User",
      email: "manager@example.com",
      role: "manager"
    }).returning();

    const [supportUser] = await db.insert(users).values({
      username: "support",
      password: "support123", // In production, this would be hashed
      name: "Support User",
      email: "support@example.com",
      role: "support"
    }).returning();

    console.log(`Created ${3} users`);

    // Create test dealerships
    console.log("Creating dealerships...");
    const [floridaMotors] = await db.insert(dealerships).values({
      name: "Florida Motors",
      location: "Miami, FL",
      contactEmail: "info@floridamotors.example.com",
      contactPhone: "555-123-4567"
    }).returning();

    const [texasAutoGroup] = await db.insert(dealerships).values({
      name: "Texas Auto Group",
      location: "Houston, TX",
      contactEmail: "info@texasautogroup.example.com",
      contactPhone: "555-234-5678"
    }).returning();

    const [californiaCars] = await db.insert(dealerships).values({
      name: "California Cars",
      location: "Los Angeles, CA",
      contactEmail: "info@californiacars.example.com",
      contactPhone: "555-345-6789"
    }).returning();

    console.log(`Created ${3} dealerships`);

    // Create test vehicles
    console.log("Creating vehicles...");
    const vehicleData = [
      {
        dealershipId: floridaMotors.id,
        make: "Toyota",
        model: "RAV4",
        year: 2023,
        trim: "XLE Premium",
        exteriorColor: "Blueprint",
        interiorColor: "Black",
        vin: "4T3Z1RFX4PU123456",
        mileage: 5,
        price: 34995,
        features: ["AWD", "Sunroof", "Heated Seats", "Apple CarPlay"],
        isActive: true
      },
      {
        dealershipId: floridaMotors.id,
        make: "Honda",
        model: "Civic",
        year: 2022,
        trim: "Touring",
        exteriorColor: "Sonic Gray",
        interiorColor: "Black",
        vin: "2HGFE1F57NH123456",
        mileage: 15000,
        price: 27995,
        features: ["Leather Seats", "Navigation", "Android Auto"],
        isActive: true
      },
      {
        dealershipId: texasAutoGroup.id,
        make: "Ford",
        model: "F-150",
        year: 2023,
        trim: "Lariat",
        exteriorColor: "Oxford White",
        interiorColor: "Tan",
        vin: "1FTFW1E52NFB12345",
        mileage: 2500,
        price: 54995,
        features: ["4x4", "Tow Package", "360 Camera", "Moonroof"],
        isActive: true
      },
      {
        dealershipId: texasAutoGroup.id,
        make: "Chevrolet",
        model: "Equinox",
        year: 2022,
        trim: "Premier",
        exteriorColor: "Mosaic Black",
        interiorColor: "Jet Black",
        vin: "3GNAXUEV7NL123456",
        mileage: 8500,
        price: 32995,
        features: ["AWD", "Leather", "Bose Audio"],
        isActive: false
      },
      {
        dealershipId: californiaCars.id,
        make: "Tesla",
        model: "Model 3",
        year: 2023,
        trim: "Long Range",
        exteriorColor: "Deep Blue Metallic",
        interiorColor: "White",
        vin: "5YJ3E1EA8PF123456",
        mileage: 1200,
        price: 49995,
        features: ["Autopilot", "Glass Roof", "Premium Audio"],
        isActive: true
      },
      {
        dealershipId: californiaCars.id,
        make: "BMW",
        model: "X5",
        year: 2023,
        trim: "xDrive40i",
        exteriorColor: "Alpine White",
        interiorColor: "Coffee",
        vin: "5UXCR6C51N9D12345",
        mileage: 3500,
        price: 68995,
        features: ["AWD", "Panoramic Roof", "Heated/Cooled Seats", "Harman Kardon Audio"],
        isActive: true
      }
    ];

    for (const vehicle of vehicleData) {
      await db.insert(vehicles).values(vehicle);
    }

    console.log(`Created ${vehicleData.length} vehicles`);

    // Create test personas
    console.log("Creating personas...");
    await db.insert(personas).values({
      dealershipId: floridaMotors.id,
      name: "Friendly Advisor",
      promptTemplate: "Be friendly, approachable and helpful. Focus on {priorityFeatures}. Use a {tone} tone.",
      arguments: {
        tone: "warm and friendly",
        priorityFeatures: ["safety", "reliability", "fuel economy"]
      },
      isDefault: true
    });

    await db.insert(personas).values({
      dealershipId: texasAutoGroup.id,
      name: "Technical Expert",
      promptTemplate: "Provide detailed technical information. Focus on {priorityFeatures}. Use a {tone} tone.",
      arguments: {
        tone: "precise and informative",
        priorityFeatures: ["performance", "technology", "specifications"]
      },
      isDefault: true
    });

    await db.insert(personas).values({
      dealershipId: californiaCars.id,
      name: "Concierge",
      promptTemplate: "Offer a premium concierge experience. Focus on {priorityFeatures}. Use a {tone} tone.",
      arguments: {
        tone: "professional and refined",
        priorityFeatures: ["luxury", "comfort", "exclusivity"]
      },
      isDefault: true
    });

    console.log(`Created 3 personas`);

    // Create API keys for dealerships
    console.log("Creating API keys...");
    for (const dealership of [floridaMotors, texasAutoGroup, californiaCars]) {
      const randomKey = randomBytes(32).toString('hex');
      const key = `ryk_${randomKey}`;
      
      await db.insert(apiKeys).values({
        dealershipId: dealership.id,
        key,
        description: `API Key for ${dealership.name}`,
        isActive: true
      });
    }

    console.log(`Created 3 API keys`);
    console.log("Database seed completed successfully!");
    
    // Fetch and display the created API keys
    const createdKeys = await db.select({
      dealershipId: apiKeys.dealershipId,
      dealershipName: dealerships.name,
      key: apiKeys.key
    })
    .from(apiKeys)
    .innerJoin(dealerships, (join) => join.on(apiKeys.dealershipId, dealerships.id));
    
    console.log("\nAPI Keys for Testing:");
    createdKeys.forEach(({dealershipName, key}) => {
      console.log(`${dealershipName}: ${key}`);
    });

  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the seed function
seedDatabase();