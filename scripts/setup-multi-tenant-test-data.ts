/**
 * Enhanced Multi-Tenant Test Data Setup for Ticket #14
 * 
 * This script sets up comprehensive test data for three dealerships (A, B, C)
 * to thoroughly test multi-tenant isolation.
 * 
 * Run with: npx tsx scripts/setup-multi-tenant-test-data.ts
 */

import { db } from '../server/db';
import logger from '../server/utils/logger';
import { 
  dealerships, 
  users, 
  vehicles,
  customers
} from '../shared/enhanced-schema';
import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';

interface TestDealership {
  id: number;
  name: string;
  subdomain: string;
  users: any[];
  vehicles: any[];
  customers: any[];
}

async function setupMultiTenantTestData() {
  logger.info('🚀 Starting enhanced multi-tenant test data setup for Ticket #14...');
  
  try {
    // Clean up existing test data first
    logger.info('🧹 Cleaning up existing test data...');
    
    // Delete existing test dealerships if they exist
    await db.delete(dealerships).where(eq(dealerships.subdomain, 'test-dealership-a'));
    await db.delete(dealerships).where(eq(dealerships.subdomain, 'test-dealership-b'));
    await db.delete(dealerships).where(eq(dealerships.subdomain, 'test-dealership-c'));
    
    // Create comprehensive test dealerships
    logger.info('🏢 Creating three test dealerships (A, B, C)...');
    
    // === DEALERSHIP A: Premium Sports Cars ===
    const dealershipA = await db.insert(dealerships).values({
      name: 'Test Dealership A - Premium Sports',
      subdomain: 'test-dealership-a',
      contact_email: 'contact@test-dealership-a.com',
      contact_phone: '(555) 001-0001',
      address: '100 Test Drive A',
      city: 'Test City A',
      state: 'CA',
      zip: '90001',
      website: 'https://test-dealership-a.com',
      description: 'Premium sports car dealership for multi-tenant testing',
      logo_url: 'https://example.com/logos/test-a.png',
      primary_color: '#FF0000',
      secondary_color: '#000000',
      accent_color: '#FFFFFF',
      persona_name: 'Alex A',
      persona_tone: 'professional',
      operation_mode: 'rylie_ai',
      active: true
    }).returning();
    
    // === DEALERSHIP B: Family Vehicles ===
    const dealershipB = await db.insert(dealerships).values({
      name: 'Test Dealership B - Family Cars',
      subdomain: 'test-dealership-b',
      contact_email: 'contact@test-dealership-b.com',
      contact_phone: '(555) 002-0002',
      address: '200 Test Drive B',
      city: 'Test City B',
      state: 'TX',
      zip: '75001',
      website: 'https://test-dealership-b.com',
      description: 'Family vehicle dealership for multi-tenant testing',
      logo_url: 'https://example.com/logos/test-b.png',
      primary_color: '#00FF00',
      secondary_color: '#FFFFFF',
      accent_color: '#0000FF',
      persona_name: 'Beth B',
      persona_tone: 'friendly',
      operation_mode: 'direct_agent',
      active: true
    }).returning();
    
    // === DEALERSHIP C: Commercial Vehicles ===
    const dealershipC = await db.insert(dealerships).values({
      name: 'Test Dealership C - Commercial Fleet',
      subdomain: 'test-dealership-c',
      contact_email: 'contact@test-dealership-c.com',
      contact_phone: '(555) 003-0003',
      address: '300 Test Drive C',
      city: 'Test City C',
      state: 'NY',
      zip: '10001',
      website: 'https://test-dealership-c.com',
      description: 'Commercial vehicle dealership for multi-tenant testing',
      logo_url: 'https://example.com/logos/test-c.png',
      primary_color: '#0000FF',
      secondary_color: '#FFFF00',
      accent_color: '#FF0000',
      persona_name: 'Charlie C',
      persona_tone: 'formal',
      operation_mode: 'rylie_ai',
      active: true
    }).returning();
    
    logger.info(`✅ Created dealerships: A (ID: ${dealershipA[0].id}), B (ID: ${dealershipB[0].id}), C (ID: ${dealershipC[0].id})`);
    
    // Create users for each dealership with different roles
    logger.info('👥 Creating users with different roles for each dealership...');
    
    const hashPassword = async (password: string) => {
      return await hash(password, 10);
    };
    
    // === DEALERSHIP A USERS ===
    const dealershipAUsers = [];
    
    // Super Admin (can access all dealerships)
    dealershipAUsers.push(await db.insert(users).values({
      username: 'super-admin-test',
      email: 'super-admin@test.com',
      password_hash: await hashPassword('super123'),
      name: 'Super Admin Test',
      role: 'super_admin',
      dealership_id: null, // Super admin has no specific dealership
      is_verified: true
    }).returning());
    
    // Dealership A Admin
    dealershipAUsers.push(await db.insert(users).values({
      username: 'admin-a',
      email: 'admin@test-dealership-a.com',
      password_hash: await hashPassword('admin123'),
      name: 'Admin Dealership A',
      role: 'dealership_admin',
      dealership_id: dealershipA[0].id,
      is_verified: true
    }).returning());
    
    // Dealership A Manager
    dealershipAUsers.push(await db.insert(users).values({
      username: 'manager-a',
      email: 'manager@test-dealership-a.com',
      password_hash: await hashPassword('manager123'),
      name: 'Manager Dealership A',
      role: 'manager',
      dealership_id: dealershipA[0].id,
      is_verified: true
    }).returning());
    
    // Dealership A Regular User
    dealershipAUsers.push(await db.insert(users).values({
      username: 'user-a',
      email: 'user@test-dealership-a.com',
      password_hash: await hashPassword('user123'),
      name: 'User Dealership A',
      role: 'user',
      dealership_id: dealershipA[0].id,
      is_verified: true
    }).returning());
    
    // === DEALERSHIP B USERS ===
    const dealershipBUsers = [];
    
    // Dealership B Admin
    dealershipBUsers.push(await db.insert(users).values({
      username: 'admin-b',
      email: 'admin@test-dealership-b.com',
      password_hash: await hashPassword('admin123'),
      name: 'Admin Dealership B',
      role: 'dealership_admin',
      dealership_id: dealershipB[0].id,
      is_verified: true
    }).returning());
    
    // Multi-dealership user (has access to both A and B)
    dealershipBUsers.push(await db.insert(users).values({
      username: 'multi-user-ab',
      email: 'multi@test-dealerships-ab.com',
      password_hash: await hashPassword('multi123'),
      name: 'Multi Dealership User A+B',
      role: 'manager',
      dealership_id: dealershipB[0].id, // Primary dealership
      is_verified: true
    }).returning());
    
    // Dealership B Regular User
    dealershipBUsers.push(await db.insert(users).values({
      username: 'user-b',
      email: 'user@test-dealership-b.com',
      password_hash: await hashPassword('user123'),
      name: 'User Dealership B',
      role: 'user',
      dealership_id: dealershipB[0].id,
      is_verified: true
    }).returning());
    
    // === DEALERSHIP C USERS ===
    const dealershipCUsers = [];
    
    // Dealership C Admin
    dealershipCUsers.push(await db.insert(users).values({
      username: 'admin-c',
      email: 'admin@test-dealership-c.com',
      password_hash: await hashPassword('admin123'),
      name: 'Admin Dealership C',
      role: 'dealership_admin',
      dealership_id: dealershipC[0].id,
      is_verified: true
    }).returning());
    
    // Dealership C Regular User
    dealershipCUsers.push(await db.insert(users).values({
      username: 'user-c',
      email: 'user@test-dealership-c.com',
      password_hash: await hashPassword('user123'),
      name: 'User Dealership C',
      role: 'user',
      dealership_id: dealershipC[0].id,
      is_verified: true
    }).returning());
    
    logger.info('✅ Created users for all dealerships');
    
    // Create distinct inventory for each dealership
    logger.info('🚗 Creating distinct vehicle inventory for each dealership...');
    
    // === DEALERSHIP A VEHICLES (Sports Cars) ===
    await db.insert(vehicles).values([
      {
        dealership_id: dealershipA[0].id,
        vin: 'TEST-A-001-SPORTS-CAR-1',
        stock_number: 'A-SPORT-001',
        make: 'Ferrari',
        model: '488 GTB',
        year: 2023,
        trim: 'Base',
        body_style: 'Coupe',
        exterior_color: 'Rosso Corsa Red',
        interior_color: 'Black Leather',
        mileage: 150,
        sale_price: 285000,
        msrp: 298000,
        condition: 'New',
        fuel_type: 'Gasoline',
        transmission: 'Automatic',
        description: 'Dealership A exclusive sports car - Ferrari 488 GTB',
        features: ['Carbon Fiber Package', 'Racing Seats', 'Premium Sound'],
        images: ['https://example.com/dealership-a/ferrari-1.jpg'],
        status: 'available'
      },
      {
        dealership_id: dealershipA[0].id,
        vin: 'TEST-A-002-SPORTS-CAR-2',
        stock_number: 'A-SPORT-002',
        make: 'Lamborghini',
        model: 'Huracán',
        year: 2023,
        trim: 'EVO',
        body_style: 'Coupe',
        exterior_color: 'Verde Mantis',
        interior_color: 'Black Alcantara',
        mileage: 200,
        sale_price: 265000,
        msrp: 280000,
        condition: 'New',
        fuel_type: 'Gasoline',
        transmission: 'Automatic',
        description: 'Dealership A exclusive sports car - Lamborghini Huracán',
        features: ['Performance Package', 'Carbon Ceramic Brakes', 'Sport Exhaust'],
        images: ['https://example.com/dealership-a/lambo-1.jpg'],
        status: 'available'
      }
    ]);
    
    // === DEALERSHIP B VEHICLES (Family Cars) ===
    await db.insert(vehicles).values([
      {
        dealership_id: dealershipB[0].id,
        vin: 'TEST-B-001-FAMILY-CAR-1',
        stock_number: 'B-FAM-001',
        make: 'Honda',
        model: 'Pilot',
        year: 2023,
        trim: 'Touring',
        body_style: 'SUV',
        exterior_color: 'White Diamond Pearl',
        interior_color: 'Beige Leather',
        mileage: 500,
        sale_price: 45000,
        msrp: 48000,
        condition: 'New',
        fuel_type: 'Gasoline',
        transmission: 'Automatic',
        description: 'Dealership B family vehicle - Honda Pilot',
        features: ['3rd Row Seating', 'Honda Sensing', 'Apple CarPlay'],
        images: ['https://example.com/dealership-b/pilot-1.jpg'],
        status: 'available'
      },
      {
        dealership_id: dealershipB[0].id,
        vin: 'TEST-B-002-FAMILY-CAR-2',
        stock_number: 'B-FAM-002',
        make: 'Toyota',
        model: 'Sienna',
        year: 2023,
        trim: 'Limited',
        body_style: 'Minivan',
        exterior_color: 'Celestial Silver',
        interior_color: 'Black Leather',
        mileage: 300,
        sale_price: 52000,
        msrp: 55000,
        condition: 'New',
        fuel_type: 'Hybrid',
        transmission: 'CVT',
        description: 'Dealership B family vehicle - Toyota Sienna Hybrid',
        features: ['Hybrid Powertrain', 'AWD', 'Safety Sense 2.0'],
        images: ['https://example.com/dealership-b/sienna-1.jpg'],
        status: 'available'
      }
    ]);
    
    // === DEALERSHIP C VEHICLES (Commercial) ===
    await db.insert(vehicles).values([
      {
        dealership_id: dealershipC[0].id,
        vin: 'TEST-C-001-COMMERCIAL-1',
        stock_number: 'C-COM-001',
        make: 'Ford',
        model: 'Transit',
        year: 2023,
        trim: 'Cargo Van',
        body_style: 'Van',
        exterior_color: 'Oxford White',
        interior_color: 'Medium Stone',
        mileage: 100,
        sale_price: 38000,
        msrp: 40000,
        condition: 'New',
        fuel_type: 'Gasoline',
        transmission: 'Automatic',
        description: 'Dealership C commercial vehicle - Ford Transit',
        features: ['High Roof', 'Commercial Package', 'Fleet Ready'],
        images: ['https://example.com/dealership-c/transit-1.jpg'],
        status: 'available'
      },
      {
        dealership_id: dealershipC[0].id,
        vin: 'TEST-C-002-COMMERCIAL-2',
        stock_number: 'C-COM-002',
        make: 'Chevrolet',
        model: 'Silverado 3500HD',
        year: 2023,
        trim: 'Work Truck',
        body_style: 'Pickup',
        exterior_color: 'Summit White',
        interior_color: 'Dark Ash',
        mileage: 50,
        sale_price: 42000,
        msrp: 44000,
        condition: 'New',
        fuel_type: 'Diesel',
        transmission: 'Automatic',
        description: 'Dealership C commercial vehicle - Silverado 3500HD',
        features: ['Heavy Duty Package', 'Towing Package', 'Fleet Options'],
        images: ['https://example.com/dealership-c/silverado-1.jpg'],
        status: 'available'
      }
    ]);
    
    logger.info('✅ Created distinct vehicle inventory for each dealership');
    
    // Create customers for each dealership
    logger.info('🧑‍🤝‍🧑 Creating customers for each dealership...');
    
    // === DEALERSHIP A CUSTOMERS ===
    await db.insert(customers).values([
      {
        dealershipId: dealershipA[0].id,
        name: 'Test Customer A1 - Sports Enthusiast',
        email: 'customer.a1@test.com',
        phone: '(555) 101-0001',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        dealershipId: dealershipA[0].id,
        name: 'Test Customer A2 - Luxury Buyer',
        email: 'customer.a2@test.com',
        phone: '(555) 101-0002',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
    
    // === DEALERSHIP B CUSTOMERS ===
    await db.insert(customers).values([
      {
        dealershipId: dealershipB[0].id,
        name: 'Test Customer B1 - Family Person',
        email: 'customer.b1@test.com',
        phone: '(555) 201-0001',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        dealershipId: dealershipB[0].id,
        name: 'Test Customer B2 - Parent Shopper',
        email: 'customer.b2@test.com',
        phone: '(555) 201-0002',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
    
    // === DEALERSHIP C CUSTOMERS ===
    await db.insert(customers).values([
      {
        dealershipId: dealershipC[0].id,
        name: 'Test Customer C1 - Fleet Manager',
        email: 'customer.c1@test.com',
        phone: '(555) 301-0001',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        dealershipId: dealershipC[0].id,
        name: 'Test Customer C2 - Business Owner',
        email: 'customer.c2@test.com',
        phone: '(555) 301-0002',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
    
    logger.info('✅ Created customers for each dealership');
    
    // Summary of created test data
    const testData = {
      dealerships: [
        { id: dealershipA[0].id, name: dealershipA[0].name, subdomain: dealershipA[0].subdomain },
        { id: dealershipB[0].id, name: dealershipB[0].name, subdomain: dealershipB[0].subdomain },
        { id: dealershipC[0].id, name: dealershipC[0].name, subdomain: dealershipC[0].subdomain }
      ],
      userCredentials: {
        superAdmin: { username: 'super-admin-test', password: 'super123' },
        dealershipA: [
          { username: 'admin-a', password: 'admin123', role: 'dealership_admin' },
          { username: 'manager-a', password: 'manager123', role: 'manager' },
          { username: 'user-a', password: 'user123', role: 'user' }
        ],
        dealershipB: [
          { username: 'admin-b', password: 'admin123', role: 'dealership_admin' },
          { username: 'multi-user-ab', password: 'multi123', role: 'manager' },
          { username: 'user-b', password: 'user123', role: 'user' }
        ],
        dealershipC: [
          { username: 'admin-c', password: 'admin123', role: 'dealership_admin' },
          { username: 'user-c', password: 'user123', role: 'user' }
        ]
      },
      vehicles: {
        dealershipA: 2, // Sports cars
        dealershipB: 2, // Family vehicles  
        dealershipC: 2  // Commercial vehicles
      },
      customers: {
        dealershipA: 2,
        dealershipB: 2,
        dealershipC: 2
      }
    };
    
    logger.info('🎉 Multi-tenant test data setup completed successfully!');
    logger.info('📊 Test Data Summary:', testData);
    
    return testData;
    
  } catch (error) {
    logger.error('❌ Error setting up multi-tenant test data:', error);
    throw error;
  }
}

// Run the script if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  setupMultiTenantTestData()
    .then((testData) => {
      logger.info('✅ Multi-tenant test data setup process completed');
      console.log('\n📋 TEST DATA SUMMARY:');
      console.log(JSON.stringify(testData, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Failed to setup multi-tenant test data:', error);
      process.exit(1);
    });
}

export { setupMultiTenantTestData };