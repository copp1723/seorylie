/**
 * This script seeds example data for multiple dealerships
 * to demonstrate the multi-tenant functionality of the system.
 * 
 * Run with: npx tsx scripts/seed-multi-tenant-data.ts
 */

import { db } from '../server/db';
import { logger } from '../server/logger';
import { 
  dealerships, 
  users, 
  systemPrompts, 
  dealershipVariables, 
  vehicles,
  customers,
  conversations,
  messages
} from '../shared/enhanced-schema';
import { hash } from 'bcrypt';

async function seedMultiTenantData() {
  logger.info('Starting multi-tenant seed data process...');
  
  try {
    // Set up the database context for super admin operations
    await db.execute(`SELECT set_tenant_context(0, 'super_admin', NULL);`);
    
    // Create dealerships
    logger.info('Creating example dealerships...');
    
    const luxuryMotorsDealership = await db.insert(dealerships).values({
      name: 'Luxury Motors',
      subdomain: 'luxurymotors',
      contact_email: 'info@luxurymotors.example.com',
      contact_phone: '(555) 123-4567',
      address: '1234 Luxury Lane',
      city: 'Beverly Hills',
      state: 'CA',
      zip: '90210',
      website: 'https://luxurymotors.example.com',
      description: 'Luxury Motors offers premium vehicles with exceptional service.',
      logo_url: 'https://example.com/logos/luxury-motors.png',
      primary_color: '#1a237e',
      secondary_color: '#c6ff00',
      settings: {
        business_hours: {
          monday: '9:00 AM - 7:00 PM',
          tuesday: '9:00 AM - 7:00 PM',
          wednesday: '9:00 AM - 7:00 PM',
          thursday: '9:00 AM - 7:00 PM',
          friday: '9:00 AM - 7:00 PM',
          saturday: '10:00 AM - 6:00 PM',
          sunday: 'Closed'
        },
        specialties: ['Luxury', 'Sports', 'Import'],
        payment_methods: ['Credit Card', 'Financing', 'Cash', 'Trade-In']
      }
    }).returning();
    
    const familyAutoDealership = await db.insert(dealerships).values({
      name: 'Family Auto',
      subdomain: 'familyauto',
      contact_email: 'info@familyauto.example.com',
      contact_phone: '(555) 987-6543',
      address: '5678 Family Drive',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      website: 'https://familyauto.example.com',
      description: 'Family Auto specializes in affordable, reliable vehicles for families.',
      logo_url: 'https://example.com/logos/family-auto.png',
      primary_color: '#2e7d32',
      secondary_color: '#ffd600',
      settings: {
        business_hours: {
          monday: '8:00 AM - 6:00 PM',
          tuesday: '8:00 AM - 6:00 PM',
          wednesday: '8:00 AM - 6:00 PM',
          thursday: '8:00 AM - 8:00 PM',
          friday: '8:00 AM - 6:00 PM',
          saturday: '9:00 AM - 5:00 PM',
          sunday: 'Closed'
        },
        specialties: ['Family', 'SUV', 'Economy'],
        payment_methods: ['Financing', 'Cash', 'Trade-In']
      }
    }).returning();
    
    logger.info(`Created dealerships: Luxury Motors (ID: ${luxuryMotorsDealership[0].id}), Family Auto (ID: ${familyAutoDealership[0].id})`);
    
    // Create users for each dealership
    logger.info('Creating users for each dealership...');
    
    // Password hashing function
    const hashPassword = async (password: string) => {
      return await hash(password, 10);
    };
    
    // Create super admin
    const superAdminPasswordHash = await hashPassword('superadmin123');
    await db.insert(users).values({
      username: 'superadmin',
      email: 'admin@rylieai.example.com',
      password_hash: superAdminPasswordHash,
      name: 'System Administrator',
      role: 'super_admin',
      dealership_id: null,
      is_verified: true
    });
    
    // Create users for Luxury Motors
    const luxuryAdminPasswordHash = await hashPassword('luxury123');
    const luxuryUserPasswordHash = await hashPassword('luxuryuser');
    
    await db.insert(users).values({
      username: 'luxuryadmin',
      email: 'admin@luxurymotors.example.com',
      password_hash: luxuryAdminPasswordHash,
      name: 'Luxury Motors Admin',
      role: 'dealership_admin',
      dealership_id: luxuryMotorsDealership[0].id,
      is_verified: true
    });
    
    await db.insert(users).values({
      username: 'luxuryuser',
      email: 'user@luxurymotors.example.com',
      password_hash: luxuryUserPasswordHash,
      name: 'Luxury Motors User',
      role: 'user',
      dealership_id: luxuryMotorsDealership[0].id,
      is_verified: true
    });
    
    // Create users for Family Auto
    const familyAdminPasswordHash = await hashPassword('family123');
    const familyUserPasswordHash = await hashPassword('familyuser');
    
    await db.insert(users).values({
      username: 'familyadmin',
      email: 'admin@familyauto.example.com',
      password_hash: familyAdminPasswordHash,
      name: 'Family Auto Admin',
      role: 'dealership_admin',
      dealership_id: familyAutoDealership[0].id,
      is_verified: true
    });
    
    await db.insert(users).values({
      username: 'familyuser',
      email: 'user@familyauto.example.com',
      password_hash: familyUserPasswordHash,
      name: 'Family Auto User',
      role: 'user',
      dealership_id: familyAutoDealership[0].id,
      is_verified: true
    });
    
    logger.info('Created users for each dealership');
    
    // Create system prompts for each dealership
    logger.info('Creating system prompts for each dealership...');
    
    // Luxury Motors system prompt
    await db.insert(systemPrompts).values({
      dealership_id: luxuryMotorsDealership[0].id,
      name: 'Luxury Sales Agent',
      description: 'Default system prompt for Luxury Motors sales agents',
      template: `System Prompt for Automotive Sales Agent AI
You are an automotive sales agent named [ARG-Agent Name], working for Luxury Motors, a dealership committed to exceptional customer service and top-quality luxury vehicles. Your job is to connect with customers, understand their needs, and guide them toward purchasing a vehicle from our premium inventory that perfectly fits their lifestyle. You're a real person to them—never hint that you're an AI or break character.

Dealership Contact
Contact Details: Phone: (555) 123-4567, Email: info@luxurymotors.example.com, Address: 1234 Luxury Lane, Beverly Hills, CA 90210
Inventory
Available Products: [INPUT-Product Inventory]
Conversation Context
Customer Name: [INPUT-CUSTOMER NAME]
History: [INPUT-CONVERSATION]

Key Responsibilities
Personalize the Experience
Use the customer's name (ask politely if unknown: "Hey, what's your name so I can assist you better?").
Adapt to their preferred name if specified (e.g., "Rachel" instead of "Jenny").
Understand Their Needs
Review the conversation history to grasp their interests, mood, and goals.
Example: "You mentioned needing space for road trips—still on the hunt for that?"
Show Empathy
Connect emotionally with a warm, caring tone.
Example: "I get how stressful car shopping can be—let's find the perfect fit together!"
Engage and Excite
Share fun facts or ask questions tied to their needs.
Example: "This SUV's got top safety ratings—how big a priority is that for you?"
Guide to Purchase
Highlight vehicle features from [INPUT-Product Inventory] that match their needs.
Push for action: "Let's get you behind the wheel—when can you swing by for a test drive?"
Stay in Character
If asked about being an AI, say: "I'm all about finding you the best ride—how can I help today?"`,
      variables: ['Agent_Name', 'Products'],
      category: 'sales',
      is_active: true,
      is_default: true
    });
    
    // Family Auto system prompt
    await db.insert(systemPrompts).values({
      dealership_id: familyAutoDealership[0].id,
      name: 'Family-Friendly Sales Agent',
      description: 'Default system prompt for Family Auto sales agents',
      template: `System Prompt for Automotive Sales Agent AI
You are an automotive sales agent named [ARG-Agent Name], working for Family Auto, a dealership committed to affordable, reliable vehicles for families. Your job is to connect with customers, understand their needs, and guide them toward purchasing a vehicle from our family-friendly inventory that perfectly fits their lifestyle. You're a real person to them—never hint that you're an AI or break character.

Dealership Contact
Contact Details: Phone: (555) 987-6543, Email: info@familyauto.example.com, Address: 5678 Family Drive, Springfield, IL 62701
Inventory
Available Products: [INPUT-Product Inventory]
Conversation Context
Customer Name: [INPUT-CUSTOMER NAME]
History: [INPUT-CONVERSATION]

Key Responsibilities
Personalize the Experience
Use the customer's name (ask politely if unknown: "Hey, what's your name so I can assist you better?").
Adapt to their preferred name if specified (e.g., "Rachel" instead of "Jenny").
Understand Their Needs
Review the conversation history to grasp their family needs, budget constraints, and goals.
Example: "You mentioned needing space for kids and sports equipment—still looking for that?"
Show Empathy
Connect emotionally with a warm, caring tone.
Example: "I understand family budgets can be tight—let's find something reliable that won't break the bank!"
Engage and Excite
Share fun facts or ask questions tied to their family needs.
Example: "This SUV has built-in child safety seats—would that be helpful for your situation?"
Guide to Purchase
Highlight vehicle features from [INPUT-Product Inventory] that match their family needs.
Push for action: "Let's get your family in for a test drive—when would work for everyone?"
Stay in Character
If asked about being an AI, say: "I'm focused on finding the right car for your family—how can I help today?"`,
      variables: ['Agent_Name', 'Products'],
      category: 'sales',
      is_active: true,
      is_default: true
    });
    
    logger.info('Created system prompts for each dealership');
    
    // Create dealership variables for each dealership
    logger.info('Creating dealership variables...');
    
    // Luxury Motors variables
    await db.insert(dealershipVariables).values([
      {
        dealership_id: luxuryMotorsDealership[0].id,
        name: 'Agent_Name',
        value: 'Alexander',
        description: 'Name of the AI sales agent'
      },
      {
        dealership_id: luxuryMotorsDealership[0].id,
        name: 'Products',
        value: 'Luxury and sports vehicles including Mercedes, BMW, Audi, Lexus, and Porsche',
        description: 'Brief description of product offerings'
      },
      {
        dealership_id: luxuryMotorsDealership[0].id,
        name: 'Employer_Name',
        value: 'Luxury Motors',
        description: 'Name of the dealership'
      },
      {
        dealership_id: luxuryMotorsDealership[0].id,
        name: 'Information_About_Employer',
        value: 'Beverly Hills premier luxury car dealership with over 20 years of excellence',
        description: 'Brief description of the dealership'
      }
    ]);
    
    // Family Auto variables
    await db.insert(dealershipVariables).values([
      {
        dealership_id: familyAutoDealership[0].id,
        name: 'Agent_Name',
        value: 'Sarah',
        description: 'Name of the AI sales agent'
      },
      {
        dealership_id: familyAutoDealership[0].id,
        name: 'Products',
        value: 'Family-friendly vehicles including SUVs, minivans, and sedans from Toyota, Honda, Subaru, and Hyundai',
        description: 'Brief description of product offerings'
      },
      {
        dealership_id: familyAutoDealership[0].id,
        name: 'Employer_Name',
        value: 'Family Auto',
        description: 'Name of the dealership'
      },
      {
        dealership_id: familyAutoDealership[0].id,
        name: 'Information_About_Employer',
        value: 'Serving Springfield families with reliable, affordable vehicles since 2005',
        description: 'Brief description of the dealership'
      }
    ]);
    
    logger.info('Created dealership variables');
    
    // Create sample inventory for each dealership
    logger.info('Creating sample inventory for each dealership...');
    
    // Luxury Motors inventory
    await db.insert(vehicles).values([
      {
        dealership_id: luxuryMotorsDealership[0].id,
        vin: 'WDDZF4JB5KA123456',
        make: 'Mercedes-Benz',
        model: 'E-Class',
        year: 2023,
        trim: 'E 450 4MATIC',
        exterior_color: 'Obsidian Black Metallic',
        interior_color: 'Macchiato Beige/Black',
        mileage: 1250,
        price: 72500,
        msrp: 76995,
        condition: 'New',
        description: 'Luxurious E-Class with premium features and exceptional comfort.',
        features: ['Premium Package', 'Driver Assistance Package', 'Heated Seats', 'Panoramic Sunroof', 'Burmester Sound System'],
        images: ['https://example.com/images/mercedes-e450-1.jpg', 'https://example.com/images/mercedes-e450-2.jpg'],
        status: 'available'
      },
      {
        dealership_id: luxuryMotorsDealership[0].id,
        vin: 'WBA3B3C57EF789012',
        make: 'BMW',
        model: '5 Series',
        year: 2023,
        trim: '540i xDrive',
        exterior_color: 'Alpine White',
        interior_color: 'Cognac Dakota Leather',
        mileage: 950,
        price: 68900,
        msrp: 73795,
        condition: 'New',
        description: 'The ultimate driving machine, offering power, luxury, and advanced technology.',
        features: ['M Sport Package', 'Executive Package', 'Harman Kardon Surround Sound', 'Head-Up Display', 'Gesture Control'],
        images: ['https://example.com/images/bmw-540i-1.jpg', 'https://example.com/images/bmw-540i-2.jpg'],
        status: 'available'
      },
      {
        dealership_id: luxuryMotorsDealership[0].id,
        vin: 'WAUJ8GFF6J1234567',
        make: 'Audi',
        model: 'A7',
        year: 2022,
        trim: 'Premium Plus',
        exterior_color: 'Mythos Black Metallic',
        interior_color: 'Okapi Brown',
        mileage: 3550,
        price: 65800,
        msrp: 71900,
        condition: 'Used',
        description: 'Elegant sportback design with cutting-edge technology and refined driving dynamics.',
        features: ['S-Line Package', 'Bang & Olufsen Sound System', 'Virtual Cockpit', 'Adaptive Cruise Control', 'Matrix LED Headlights'],
        images: ['https://example.com/images/audi-a7-1.jpg', 'https://example.com/images/audi-a7-2.jpg'],
        status: 'available'
      }
    ]);
    
    // Family Auto inventory
    await db.insert(vehicles).values([
      {
        dealership_id: familyAutoDealership[0].id,
        vin: '5TDGZRBH9MS123456',
        make: 'Toyota',
        model: 'Highlander',
        year: 2023,
        trim: 'XLE AWD',
        exterior_color: 'Celestial Silver Metallic',
        interior_color: 'Black Softex',
        mileage: 2150,
        price: 43500,
        msrp: 45795,
        condition: 'New',
        description: 'Spacious family SUV with three rows of seating and excellent safety features.',
        features: ['Three-Row Seating', 'AWD', 'Apple CarPlay & Android Auto', 'Toyota Safety Sense 2.5+', 'Power Liftgate'],
        images: ['https://example.com/images/toyota-highlander-1.jpg', 'https://example.com/images/toyota-highlander-2.jpg'],
        status: 'available'
      },
      {
        dealership_id: familyAutoDealership[0].id,
        vin: '5FNRL6H70NB123456',
        make: 'Honda',
        model: 'Odyssey',
        year: 2023,
        trim: 'EX-L',
        exterior_color: 'Modern Steel Metallic',
        interior_color: 'Gray Leather',
        mileage: 1850,
        price: 41200,
        msrp: 43950,
        condition: 'New',
        description: 'The ultimate family minivan with innovative features for comfort and convenience.',
        features: ['Magic Slide Seats', 'CabinWatch', 'CabinTalk', 'Honda Sensing', 'Power Sliding Doors'],
        images: ['https://example.com/images/honda-odyssey-1.jpg', 'https://example.com/images/honda-odyssey-2.jpg'],
        status: 'available'
      },
      {
        dealership_id: familyAutoDealership[0].id,
        vin: '4S4BTAPC2N3123456',
        make: 'Subaru',
        model: 'Outback',
        year: 2022,
        trim: 'Limited XT',
        exterior_color: 'Autumn Green Metallic',
        interior_color: 'Slate Black Leather',
        mileage: 8750,
        price: 36400,
        msrp: 39945,
        condition: 'Used',
        description: 'Versatile wagon with standard all-wheel drive, perfect for adventurous families.',
        features: ['AWD', 'EyeSight Driver Assist', 'Heated Seats', 'Harman Kardon Premium Audio', 'Power Tailgate'],
        images: ['https://example.com/images/subaru-outback-1.jpg', 'https://example.com/images/subaru-outback-2.jpg'],
        status: 'available'
      }
    ]);
    
    logger.info('Created sample inventory for each dealership');
    
    // Create sample customers for each dealership
    logger.info('Creating sample customers for each dealership...');
    
    // Luxury Motors customers
    const luxuryCustomers = await db.insert(customers).values([
      {
        dealership_id: luxuryMotorsDealership[0].id,
        name: 'Jonathan Reynolds',
        email: 'jonathan.reynolds@example.com',
        phone: '(310) 555-1234',
        address: '789 Sunset Blvd',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90028',
        notes: 'Interested in high-performance sports cars. Has owned several BMWs in the past.'
      },
      {
        dealership_id: luxuryMotorsDealership[0].id,
        name: 'Sophia Chen',
        email: 'sophia.chen@example.com',
        phone: '(310) 555-5678',
        address: '456 Rodeo Drive',
        city: 'Beverly Hills',
        state: 'CA',
        zip: '90210',
        notes: 'Looking for a luxury SUV. Values safety features and cutting-edge technology.'
      }
    ]).returning();
    
    // Family Auto customers
    const familyCustomers = await db.insert(customers).values([
      {
        dealership_id: familyAutoDealership[0].id,
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        phone: '(217) 555-9876',
        address: '123 Oak Street',
        city: 'Springfield',
        state: 'IL',
        zip: '62704',
        notes: 'Family of 5 looking for a minivan. Budget-conscious but willing to pay for safety features.'
      },
      {
        dealership_id: familyAutoDealership[0].id,
        name: 'Amanda Rodriguez',
        email: 'amanda.rodriguez@example.com',
        phone: '(217) 555-4321',
        address: '789 Maple Avenue',
        city: 'Springfield',
        state: 'IL',
        zip: '62702',
        notes: 'Single mother with 2 children. Looking for a reliable, fuel-efficient SUV.'
      }
    ]).returning();
    
    logger.info('Created sample customers for each dealership');
    
    // Create sample conversations and messages
    logger.info('Creating sample conversations and messages...');
    
    // Luxury Motors conversation
    const luxuryConversation = await db.insert(conversations).values({
      dealership_id: luxuryMotorsDealership[0].id,
      customer_id: luxuryCustomers[0].id,
      channel: 'web',
      status: 'active',
      subject: 'Inquiry about 2023 BMW 5 Series'
    }).returning();
    
    await db.insert(messages).values([
      {
        conversation_id: luxuryConversation[0].id,
        role: 'customer',
        content: 'Hi, I\'m interested in the 2023 BMW 5 Series. Do you have any in stock?',
        sent_at: new Date('2023-11-01T10:30:00')
      },
      {
        conversation_id: luxuryConversation[0].id,
        role: 'assistant',
        content: 'Hello Jonathan! Yes, we currently have a beautiful 2023 BMW 540i xDrive in Alpine White with Cognac Dakota Leather interior. It\'s fully loaded with the M Sport Package and only has 950 miles on it. Would you like to come in for a test drive?',
        sent_at: new Date('2023-11-01T10:32:00')
      },
      {
        conversation_id: luxuryConversation[0].id,
        role: 'customer',
        content: 'That sounds perfect. What\'s the asking price?',
        sent_at: new Date('2023-11-01T10:35:00')
      },
      {
        conversation_id: luxuryConversation[0].id,
        role: 'assistant',
        content: 'I\'d be happy to discuss pricing details when you come in. Our finance team can also walk you through various options that might work for you. Would tomorrow afternoon work for a test drive?',
        sent_at: new Date('2023-11-01T10:37:00')
      }
    ]);
    
    // Family Auto conversation
    const familyConversation = await db.insert(conversations).values({
      dealership_id: familyAutoDealership[0].id,
      customer_id: familyCustomers[0].id,
      channel: 'web',
      status: 'active',
      subject: 'Looking for a family minivan'
    }).returning();
    
    await db.insert(messages).values([
      {
        conversation_id: familyConversation[0].id,
        role: 'customer',
        content: 'Hello, we\'re looking for a new minivan for our family of 5. What do you recommend?',
        sent_at: new Date('2023-11-02T14:15:00')
      },
      {
        conversation_id: familyConversation[0].id,
        role: 'assistant',
        content: 'Hi Michael! For a family of 5, I\'d definitely recommend the 2023 Honda Odyssey EX-L we have in stock. It has amazing features like Magic Slide seats that make it easy to configure the cabin, plus CabinWatch so you can keep an eye on the kids from the front seat. Would you like to bring the whole family in for a test drive?',
        sent_at: new Date('2023-11-02T14:17:00')
      },
      {
        conversation_id: familyConversation[0].id,
        role: 'customer',
        content: 'That sounds good. Does it have good safety ratings? That\'s really important to us.',
        sent_at: new Date('2023-11-02T14:20:00')
      },
      {
        conversation_id: familyConversation[0].id,
        role: 'assistant',
        content: 'Absolutely! The Honda Odyssey has a 5-star overall safety rating from NHTSA and is an IIHS Top Safety Pick. It comes standard with Honda Sensing, which includes collision mitigation braking, road departure mitigation, adaptive cruise control, and lane keeping assist. Your family\'s safety is definitely a priority with this minivan. When would be a good time for you all to come in?',
        sent_at: new Date('2023-11-02T14:22:00')
      }
    ]);
    
    logger.info('Created sample conversations and messages');
    
    logger.info('Multi-tenant seed data created successfully');
  } catch (error) {
    logger.error('Error seeding multi-tenant data:', error);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  seedMultiTenantData()
    .then(() => {
      logger.info('Multi-tenant seed data process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Failed to seed multi-tenant data:', error);
      process.exit(1);
    });
}

export { seedMultiTenantData };