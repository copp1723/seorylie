import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';

/**
 * This script sets up a minimal test environment for the Rylie AI platform
 */
async function testSetup() {
  console.log('Setting up test environment...');

  try {
    // 1. Create test dealership if it doesn't exist
    console.log('Creating test dealership...');
    const existingDealershipResult = await db.execute(sql`
      SELECT id FROM dealerships WHERE name = 'Test Dealership' LIMIT 1
    `);
    
    let dealershipId: number;
    
    if (existingDealershipResult.rows && existingDealershipResult.rows.length > 0) {
      console.log('Test dealership already exists.');
      dealershipId = existingDealershipResult.rows[0].id;
    } else {
      const newDealershipResult = await db.execute(sql`
        INSERT INTO dealerships (name, location, contact_email, contact_phone, domain, handover_email)
        VALUES ('Test Dealership', '123 Test Street, Testville, CA 90210', 'contact@testdealership.com', '(555) 123-4567', 'testdealership.com', 'sales@testdealership.com')
        RETURNING id
      `);
      
      dealershipId = newDealershipResult.rows[0].id;
      console.log(`Created test dealership with ID: ${dealershipId}`);
    }

    // 2. Create admin user if it doesn't exist
    console.log('Creating admin user...');
    const adminId = '1234567890'; // Sample user ID for testing
    const existingAdminResult = await db.execute(sql`
      SELECT id FROM users WHERE id = ${adminId} LIMIT 1
    `);
    
    if (existingAdminResult.rows && existingAdminResult.rows.length > 0) {
      console.log('Admin user already exists.');
    } else {
      await db.execute(sql`
        INSERT INTO users (id, username, name, email, password, role, dealership_id)
        VALUES (${adminId}, 'admin_user', 'Admin User', 'admin@testdealership.com', 'hashed_password_here', 'admin', ${dealershipId})
      `);
      console.log('Created admin user.');
    }

    // 3. Create API key if it doesn't exist
    console.log('Creating API key...');
    const existingApiKeyResult = await db.execute(sql`
      SELECT key FROM api_keys WHERE dealership_id = ${dealershipId} LIMIT 1
    `);
    
    let apiKeyValue: string;
    
    if (existingApiKeyResult.rows && existingApiKeyResult.rows.length > 0) {
      console.log('API key already exists.');
      apiKeyValue = existingApiKeyResult.rows[0].key;
    } else {
      apiKeyValue = `key_${crypto.randomBytes(16).toString('hex')}`;
      await db.execute(sql`
        INSERT INTO api_keys (dealership_id, key, description, is_active)
        VALUES (${dealershipId}, ${apiKeyValue}, 'Test API Key', true)
      `);
      console.log(`Created API key: ${apiKeyValue}`);
    }

    // 4. Create default persona if it doesn't exist
    console.log('Creating default persona...');
    const existingPersonaResult = await db.execute(sql`
      SELECT id FROM personas WHERE dealership_id = ${dealershipId} LIMIT 1
    `);
    
    if (existingPersonaResult.rows && existingPersonaResult.rows.length > 0) {
      console.log('Default persona already exists.');
    } else {
      const promptTemplate = `You are Rylie, an AI assistant for {{dealershipName}}. Your role is to help customers find the right vehicle for their needs and connect them with our sales team when appropriate.

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

Always remember to personalize your responses for {{customerName}}.`;
      
      const personaArgs = JSON.stringify({
        tone: 'professional',
        priorityFeatures: ['Safety', 'Fuel Efficiency', 'Technology'],
        tradeInUrl: 'https://testdealership.com/trade-in',
        financingUrl: 'https://testdealership.com/financing',
        handoverEmail: 'sales@testdealership.com'
      });
      
      await db.execute(sql`
        INSERT INTO personas (dealership_id, name, prompt_template, arguments, is_default)
        VALUES (${dealershipId}, 'Default Sales Assistant', ${promptTemplate}, ${personaArgs}::jsonb, true)
      `);
      console.log('Created default persona.');
    }

    // 5. Create sample vehicle if none exist
    console.log('Checking for vehicles...');
    const existingVehiclesResult = await db.execute(sql`
      SELECT id FROM vehicles WHERE dealership_id = ${dealershipId} LIMIT 1
    `);
    
    if (existingVehiclesResult.rows && existingVehiclesResult.rows.length > 0) {
      console.log('Vehicles already exist.');
    } else {
      console.log('Creating sample vehicles...');
      
      // Toyota RAV4
      await db.execute(sql`
        INSERT INTO vehicles (
          dealership_id, stock_number, make, model, year, trim, exterior_color, 
          interior_color, vin, mileage, price, msrp, body_style, transmission, 
          engine, fuel_type, drivetrain, features, description, images, status
        ) VALUES (
          ${dealershipId}, 'ST12345', 'Toyota', 'RAV4', 2025, 'XLE Premium', 
          'Midnight Black Metallic', 'Black Leather', 'TEST12345678901234', 0, 
          31495, 32999, 'SUV', '8-Speed Automatic', '2.5L 4-Cylinder', 'Hybrid', 
          'All-Wheel Drive', ARRAY['Sunroof', 'Navigation', 'Premium Audio'], 
          'Brand new Toyota RAV4 Hybrid with excellent fuel economy.', 
          ARRAY['https://example.com/img1.jpg'], 'active'
        )
      `);
      
      // Honda Accord
      await db.execute(sql`
        INSERT INTO vehicles (
          dealership_id, stock_number, make, model, year, trim, exterior_color, 
          interior_color, vin, mileage, price, msrp, body_style, transmission, 
          engine, fuel_type, drivetrain, features, description, images, status
        ) VALUES (
          ${dealershipId}, 'ST54321', 'Honda', 'Accord', 2024, 'Sport', 
          'Platinum White Pearl', 'Black Cloth', 'TEST98765432109876', 0, 
          27895, 28999, 'Sedan', 'CVT', '1.5L Turbo', 'Gasoline', 
          'Front-Wheel Drive', ARRAY['Apple CarPlay', 'Android Auto', 'Lane Keep Assist'], 
          'Stylish and efficient Honda Accord Sport.', 
          ARRAY['https://example.com/img2.jpg'], 'active'
        )
      `);
      
      // Ford F-150
      await db.execute(sql`
        INSERT INTO vehicles (
          dealership_id, stock_number, make, model, year, trim, exterior_color, 
          interior_color, vin, mileage, price, msrp, body_style, transmission, 
          engine, fuel_type, drivetrain, features, description, images, status
        ) VALUES (
          ${dealershipId}, 'ST67890', 'Ford', 'F-150', 2024, 'Lariat', 
          'Velocity Blue', 'Medium Earth Gray', 'TEST13579246802468', 0, 
          51995, 53995, 'Truck', '10-Speed Automatic', '3.5L EcoBoost V6', 'Gasoline', 
          '4x4', ARRAY['Leather Seats', 'SYNC 4', 'Tow Package'], 
          'Powerful and capable Ford F-150 Lariat.', 
          ARRAY['https://example.com/img3.jpg'], 'active'
        )
      `);
      
      console.log('Created 3 sample vehicles.');
    }

    console.log('\nTEST ENVIRONMENT READY:');
    console.log('============================');
    console.log(`Dealership ID: ${dealershipId}`);
    console.log(`API Key: ${apiKeyValue || '(use existing key)'}`);
    console.log('Admin User ID: 1234567890');
    console.log('============================');
    
    console.log('\nNext steps:');
    console.log('1. Make sure to add these environment variables:');
    console.log('   - SESSION_SECRET=your_secure_session_secret');
    console.log('   - OPENAI_API_KEY=your_openai_api_key');
    console.log('   - SENDGRID_API_KEY=your_sendgrid_api_key');
    console.log('   - REPLIT_DOMAINS=your_replit_domain');
    
  } catch (error) {
    console.error('Error setting up test environment:', error);
    process.exit(1);
  }
}

// Run the setup
testSetup()
  .then(() => {
    console.log('Test environment setup complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to set up test environment:', error);
    process.exit(1);
  });