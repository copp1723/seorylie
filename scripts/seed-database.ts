import { db } from '../server/db';
import { 
  dealerships, 
  users, 
  vehicles, 
  personas, 
  apiKeys 
} from '../shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';

/**
 * This script sets up essential seed data for testing the application
 * It creates test dealerships, users, vehicles, and personas
 */
async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // 1. Create test dealership
    console.log('Creating test dealership...');
    const existingDealership = await db.select().from(dealerships)
      .where(eq(dealerships.name, 'Test Dealership'))
      .limit(1);
    
    let dealershipId: number;
    
    if (existingDealership.length > 0) {
      console.log('Test dealership already exists.');
      dealershipId = existingDealership[0].id;
    } else {
      const [newDealership] = await db.insert(dealerships).values({
        name: 'Test Dealership',
        location: '123 Test Street, Testville, CA 90210',
        contactEmail: 'contact@testdealership.com',
        contactPhone: '(555) 123-4567',
        domain: 'testdealership.com',
        handoverEmail: 'sales@testdealership.com'
      }).returning();
      
      dealershipId = newDealership.id;
      console.log(`Created test dealership with ID: ${dealershipId}`);
    }

    // 2. Create admin user
    console.log('Creating admin user...');
    const adminId = '1234567890'; // Sample Replit user ID for testing
    const existingAdmin = await db.select().from(users)
      .where(eq(users.id, adminId))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('Admin user already exists.');
    } else {
      await db.insert(users).values({
        id: adminId,
        email: 'admin@testdealership.com',
        name: 'Admin User',
        role: 'admin',
        dealershipId
      });
      console.log('Created admin user.');
    }

    // 3. Create API key for testing
    console.log('Creating API key...');
    const existingApiKey = await db.select().from(apiKeys)
      .where(eq(apiKeys.dealershipId, dealershipId))
      .limit(1);
    
    let apiKeyValue: string;
    
    if (existingApiKey.length > 0) {
      console.log('API key already exists.');
      apiKeyValue = existingApiKey[0].key;
    } else {
      apiKeyValue = `key_${crypto.randomBytes(16).toString('hex')}`;
      await db.insert(apiKeys).values({
        dealershipId,
        key: apiKeyValue,
        description: 'Test API Key',
        isActive: true
      });
      console.log(`Created API key: ${apiKeyValue}`);
    }

    // 4. Create default persona
    console.log('Creating default persona...');
    const existingPersona = await db.select().from(personas)
      .where(eq(personas.dealershipId, dealershipId))
      .limit(1);
    
    if (existingPersona.length > 0) {
      console.log('Default persona already exists.');
    } else {
      await db.insert(personas).values({
        dealershipId,
        name: 'Default Sales Assistant',
        isDefault: true,
        promptTemplate: `You are Rylie, an AI assistant for {{dealershipName}}. Your role is to help customers find the right vehicle for their needs and connect them with our sales team when appropriate.

TONE:
- Maintain a friendly, helpful, and professional tone
- Be conversational but concise
- Use simple language without car jargon unless the customer introduces it

GOALS:
- Help customers find vehicles that match their needs
- Answer questions about our inventory, financing, and trade-ins
- Collect customer information to better assist them
- Escalate to a human sales representative when appropriate

WHEN TO ESCALATE:
- If the customer asks to speak with a human
- When discussing specific pricing or payment details
- If the customer is ready to schedule a test drive
- If you can't answer a detailed question about a specific vehicle

INFORMATION TO COLLECT:
- Vehicle preferences (type, features, budget)
- Timeline for purchase
- Trade-in information
- Financing needs

Always remember to personalize your responses for {{customerName}}.`,
        arguments: {
          tone: 'professional',
          priorityFeatures: ['Safety', 'Fuel Efficiency', 'Technology'],
          tradeInUrl: 'https://testdealership.com/trade-in',
          financingUrl: 'https://testdealership.com/financing',
          handoverEmail: 'sales@testdealership.com'
        }
      });
      console.log('Created default persona.');
    }

    // 5. Import sample inventory data
    console.log('Importing sample inventory...');
    const sampleTsvPath = path.join(__dirname, '../attached_assets/_Inventory   - Sheet1.tsv');
    
    if (fs.existsSync(sampleTsvPath)) {
      // First check if we already have vehicles
      const existingVehicles = await db.select().from(vehicles)
        .where(eq(vehicles.dealershipId, dealershipId))
        .limit(1);
      
      if (existingVehicles.length > 0) {
        console.log('Vehicles already exist. Skipping import.');
      } else {
        const vehiclePromises: Promise<any>[] = [];
        
        fs.createReadStream(sampleTsvPath)
          .pipe(csv({ separator: '\\t' }))
          .on('data', (row: any) => {
            // Process each vehicle row
            const vehicleData = {
              dealershipId,
              vin: row.vin || `TEST${Math.floor(Math.random() * 1000000)}`,
              stockNumber: row.stock_number || `ST${Math.floor(Math.random() * 10000)}`,
              make: row.make || 'Unknown',
              model: row.model || 'Unknown',
              year: parseInt(row.year) || new Date().getFullYear(),
              trim: row.trim || '',
              bodyStyle: row.body_style || '',
              extColor: row.ext_color || '',
              intColor: row.int_color || '',
              mileage: parseInt(row.mileage) || 0,
              engine: row.engine || '',
              transmission: row.transmission || '',
              drivetrain: row.drivetrain || '',
              fuelType: row.fuel_type || '',
              fuelEconomy: parseInt(row.fuel_economy) || null,
              msrp: parseFloat(row.msrp) || null,
              salePrice: parseFloat(row.sale_price) || null,
              status: row.status || 'Available',
              certified: row.certified === 'Yes',
              description: row.description || '',
              features: row.features ? row.features.split(',').map((f: string) => f.trim()) : [],
              images: row.images ? row.images.split(',').map((i: string) => i.trim()) : [],
              videoUrl: row.video_url || ''
            };
            
            vehiclePromises.push(db.insert(vehicles).values(vehicleData));
          })
          .on('end', async () => {
            try {
              await Promise.all(vehiclePromises);
              console.log(`Imported ${vehiclePromises.length} vehicles.`);
            } catch (error) {
              console.error('Error importing vehicles:', error);
            }
          });
        
        // Wait a bit for import to finish
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else {
      console.log('Sample TSV file not found. Skipping vehicle import.');
      // Create a few sample vehicles
      const existingVehicles = await db.select().from(vehicles)
        .where(eq(vehicles.dealershipId, dealershipId))
        .limit(1);
      
      if (existingVehicles.length > 0) {
        console.log('Vehicles already exist. Skipping creation.');
      } else {
        console.log('Creating sample vehicles...');
        const sampleVehicles = [
          {
            dealershipId,
            vin: 'TEST12345678901234',
            stockNumber: 'ST12345',
            make: 'Toyota',
            model: 'RAV4',
            year: 2025,
            trim: 'XLE Premium',
            bodyStyle: 'SUV',
            extColor: 'Midnight Black Metallic',
            intColor: 'Black Leather',
            mileage: 0,
            engine: '2.5L 4-Cylinder',
            transmission: '8-Speed Automatic',
            drivetrain: 'All-Wheel Drive',
            fuelType: 'Hybrid',
            fuelEconomy: 40,
            msrp: 32999,
            salePrice: 31495,
            status: 'Available',
            certified: false,
            description: 'Brand new Toyota RAV4 Hybrid with excellent fuel economy.',
            features: ['Sunroof', 'Navigation', 'Premium Audio'],
            images: ['https://example.com/img1.jpg'],
            videoUrl: ''
          },
          {
            dealershipId,
            vin: 'TEST98765432109876',
            stockNumber: 'ST54321',
            make: 'Honda',
            model: 'Accord',
            year: 2024,
            trim: 'Sport',
            bodyStyle: 'Sedan',
            extColor: 'Platinum White Pearl',
            intColor: 'Black Cloth',
            mileage: 0,
            engine: '1.5L Turbo',
            transmission: 'CVT',
            drivetrain: 'Front-Wheel Drive',
            fuelType: 'Gasoline',
            fuelEconomy: 32,
            msrp: 28999,
            salePrice: 27895,
            status: 'Available',
            certified: false,
            description: 'Stylish and efficient Honda Accord Sport.',
            features: ['Apple CarPlay', 'Android Auto', 'Lane Keep Assist'],
            images: ['https://example.com/img2.jpg'],
            videoUrl: ''
          },
          {
            dealershipId,
            vin: 'TEST13579246802468',
            stockNumber: 'ST67890',
            make: 'Ford',
            model: 'F-150',
            year: 2024,
            trim: 'Lariat',
            bodyStyle: 'Truck',
            extColor: 'Velocity Blue',
            intColor: 'Medium Earth Gray',
            mileage: 0,
            engine: '3.5L EcoBoost V6',
            transmission: '10-Speed Automatic',
            drivetrain: '4x4',
            fuelType: 'Gasoline',
            fuelEconomy: 22,
            msrp: 53995,
            salePrice: 51995,
            status: 'Available',
            certified: false,
            description: 'Powerful and capable Ford F-150 Lariat.',
            features: ['Leather Seats', 'SYNC 4', 'Tow Package'],
            images: ['https://example.com/img3.jpg'],
            videoUrl: ''
          }
        ];
        
        for (const vehicle of sampleVehicles) {
          await db.insert(vehicles).values(vehicle);
        }
        
        console.log(`Created ${sampleVehicles.length} sample vehicles.`);
      }
    }

    // 6. Ensure conversation status enum exists
    console.log('Checking conversation status enum...');
    try {
      const checkEnumQuery = sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_type 
          WHERE typname = 'conversation_status'
        )
      `;
      
      const enumExists = await db.execute(checkEnumQuery);
      
      if (!enumExists || !enumExists.rows[0] || !enumExists.rows[0].exists) {
        console.log('Creating conversation status enum...');
        const createEnumQuery = sql`
          CREATE TYPE conversation_status AS ENUM ('active', 'waiting', 'escalated', 'completed')
        `;
        
        await db.execute(createEnumQuery);
        console.log('Created conversation status enum.');
      } else {
        console.log('Conversation status enum already exists.');
      }
    } catch (error) {
      console.log('Error checking/creating enum:', error);
      console.log('Will continue with seeding process...');
    }

    console.log('Database seeding completed successfully.');
    
    console.log('\nTEST ENVIRONMENT CREDENTIALS:');
    console.log('============================');
    console.log(`Dealership ID: ${dealershipId}`);
    console.log(`API Key: ${apiKeyValue}`);
    console.log('Admin User ID: 1234567890');
    console.log('============================');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed
seedDatabase()
  .then(() => {
    console.log('Seed complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });