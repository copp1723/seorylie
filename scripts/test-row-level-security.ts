/**
 * test-row-level-security.ts
 * 
 * Comprehensive test suite for validating Row Level Security (RLS) policies.
 * This script tests direct database queries to ensure RLS is properly enforced
 * at the database level, preventing cross-tenant data access.
 * 
 * Usage:
 *   npx tsx scripts/test-row-level-security.ts
 */

import { db } from '../server/db';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

// Test configuration
const TEST_CONFIG = {
  // Number of test dealerships to create
  dealershipCount: 3,
  // Number of vehicles per dealership
  vehiclesPerDealership: 5,
  // Number of conversations per dealership
  conversationsPerDealership: 3,
  // Clean up test data after running
  cleanupAfterTest: true
};

// Test data containers
interface TestDealership {
  id: number;
  name: string;
}

interface TestVehicle {
  id: string;
  dealershipId: number;
  make: string;
  model: string;
}

interface TestConversation {
  id: string;
  dealershipId: number;
  subject: string;
}

// Global test data
const testData = {
  dealerships: [] as TestDealership[],
  vehicles: [] as TestVehicle[],
  conversations: [] as TestConversation[],
};

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
};

/**
 * Sets up the RLS context for testing a specific dealership and role
 */
async function setupRlsContext(dealershipId: number, role: string): Promise<void> {
  await db.execute(`SELECT setup_rls_context($1, $2)`, [dealershipId, role]);
  console.log(chalk.blue(`Set RLS context: dealership=${dealershipId}, role=${role}`));
}

/**
 * Clears the RLS context
 */
async function clearRlsContext(): Promise<void> {
  await db.execute(`SELECT setup_rls_context(NULL, NULL)`);
}

/**
 * Creates test data for RLS testing
 */
async function createTestData(): Promise<void> {
  console.log(chalk.blue('Creating test data...'));

  // Create test dealerships
  for (let i = 1; i <= TEST_CONFIG.dealershipCount; i++) {
    const name = `RLS Test Dealership ${i}`;
    const result = await db.execute(
      `INSERT INTO dealerships (name, subdomain, contact_email, active) 
       VALUES ($1, $2, $3, true) RETURNING id`,
      [name, `rls-test-${i}`, `rls-test-${i}@example.com`]
    );

    const dealershipId = result.rows[0].id;
    testData.dealerships.push({ id: dealershipId, name });
    
    // Create vehicles for this dealership
    for (let v = 1; v <= TEST_CONFIG.vehiclesPerDealership; v++) {
      const vehicleId = uuidv4();
      const make = `Make-${i}`;
      const model = `Model-${v}`;
      
      await db.execute(
        `INSERT INTO vehicles (id, dealership_id, make, model, year, status)
         VALUES ($1, $2, $3, $4, 2025, 'available')`,
        [vehicleId, dealershipId, make, model]
      );
      
      testData.vehicles.push({ id: vehicleId, dealershipId, make, model });
    }
    
    // Create conversations for this dealership
    for (let c = 1; c <= TEST_CONFIG.conversationsPerDealership; c++) {
      const conversationId = uuidv4();
      const subject = `Test Conversation ${i}-${c}`;
      
      await db.execute(
        `INSERT INTO conversations (id, dealership_id, subject, status)
         VALUES ($1, $2, $3, 'open')`,
        [conversationId, dealershipId, subject]
      );
      
      testData.conversations.push({ id: conversationId, dealershipId, subject });
    }
  }

  console.log(chalk.green(`Created ${testData.dealerships.length} dealerships`));
  console.log(chalk.green(`Created ${testData.vehicles.length} vehicles`));
  console.log(chalk.green(`Created ${testData.conversations.length} conversations`));
}

/**
 * Cleans up test data
 */
async function cleanupTestData(): Promise<void> {
  console.log(chalk.blue('Cleaning up test data...'));
  
  // Clear RLS context first
  await clearRlsContext();
  
  // Delete in reverse order of dependencies
  for (const conversation of testData.conversations) {
    await db.execute(`DELETE FROM conversations WHERE id = $1`, [conversation.id]);
  }
  
  for (const vehicle of testData.vehicles) {
    await db.execute(`DELETE FROM vehicles WHERE id = $1`, [vehicle.id]);
  }
  
  for (const dealership of testData.dealerships) {
    await db.execute(`DELETE FROM dealerships WHERE id = $1`, [dealership.id]);
  }
  
  // Clear test data arrays
  testData.conversations = [];
  testData.vehicles = [];
  testData.dealerships = [];
  
  console.log(chalk.green('Test data cleanup complete'));
}

/**
 * Runs a test and tracks results
 */
async function runTest(
  name: string,
  testFn: () => Promise<boolean>,
  expectedToPass: boolean = true
): Promise<void> {
  testResults.total++;
  
  try {
    console.log(chalk.blue(`Running test: ${name}`));
    const passed = await testFn();
    
    if (passed === expectedToPass) {
      testResults.passed++;
      console.log(chalk.green(`✓ PASSED: ${name}`));
    } else {
      testResults.failed++;
      console.log(chalk.red(`✗ FAILED: ${name}`));
      if (expectedToPass) {
        console.log(chalk.red(`  Expected test to pass but it failed`));
      } else {
        console.log(chalk.red(`  Expected test to fail but it passed (security issue!)`));
      }
    }
  } catch (error) {
    testResults.failed++;
    console.log(chalk.red(`✗ ERROR: ${name}`));
    console.log(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Test: Verify RLS is enabled on tables
 */
async function testRlsEnabled(): Promise<boolean> {
  const tables = ['conversations', 'vehicles', 'users', 'leads', 'customers'];
  let allEnabled = true;
  
  for (const table of tables) {
    const result = await db.execute(`
      SELECT relrowsecurity FROM pg_class 
      WHERE relname = $1 AND relkind = 'r'
    `, [table]);
    
    const rlsEnabled = result?.rows?.[0]?.relrowsecurity === true;
    
    if (!rlsEnabled) {
      console.log(chalk.red(`RLS not enabled on table: ${table}`));
      allEnabled = false;
    }
  }
  
  return allEnabled;
}

/**
 * Test: Super admin can access all dealerships' data
 */
async function testSuperAdminAccess(): Promise<boolean> {
  // Set context as super_admin
  await setupRlsContext(null, 'super_admin');
  
  // Try to query vehicles from all dealerships
  const vehicleResult = await db.execute(`
    SELECT COUNT(*) as count FROM vehicles
  `);
  
  const vehicleCount = parseInt(vehicleResult?.rows?.[0]?.count || '0', 10);
  const expectedVehicleCount = testData.vehicles.length;
  
  // Try to query conversations from all dealerships
  const conversationResult = await db.execute(`
    SELECT COUNT(*) as count FROM conversations
  `);
  
  const conversationCount = parseInt(conversationResult?.rows?.[0]?.count || '0', 10);
  const expectedConversationCount = testData.conversations.length;
  
  // Clear context
  await clearRlsContext();
  
  return (
    vehicleCount === expectedVehicleCount && 
    conversationCount === expectedConversationCount
  );
}

/**
 * Test: Regular user can only access their dealership's data
 */
async function testRegularUserAccess(): Promise<boolean> {
  if (testData.dealerships.length < 2) {
    throw new Error('Need at least 2 dealerships for this test');
  }
  
  const dealership = testData.dealerships[0];
  
  // Set context as regular user for the first dealership
  await setupRlsContext(dealership.id, 'user');
  
  // Count vehicles for this dealership
  const expectedVehicleCount = testData.vehicles.filter(
    v => v.dealershipId === dealership.id
  ).length;
  
  // Try to query vehicles
  const vehicleResult = await db.execute(`
    SELECT COUNT(*) as count FROM vehicles
  `);
  
  const vehicleCount = parseInt(vehicleResult?.rows?.[0]?.count || '0', 10);
  
  // Count conversations for this dealership
  const expectedConversationCount = testData.conversations.filter(
    c => c.dealershipId === dealership.id
  ).length;
  
  // Try to query conversations
  const conversationResult = await db.execute(`
    SELECT COUNT(*) as count FROM conversations
  `);
  
  const conversationCount = parseInt(conversationResult?.rows?.[0]?.count || '0', 10);
  
  // Clear context
  await clearRlsContext();
  
  return (
    vehicleCount === expectedVehicleCount && 
    conversationCount === expectedConversationCount
  );
}

/**
 * Test: Cross-tenant isolation prevents access to other dealerships' data
 */
async function testCrossTenantIsolation(): Promise<boolean> {
  if (testData.dealerships.length < 2) {
    throw new Error('Need at least 2 dealerships for this test');
  }
  
  const dealership1 = testData.dealerships[0];
  const dealership2 = testData.dealerships[1];
  
  // Set context as regular user for the first dealership
  await setupRlsContext(dealership1.id, 'user');
  
  // Try to access a vehicle from the second dealership
  const vehicle = testData.vehicles.find(v => v.dealershipId === dealership2.id);
  if (!vehicle) {
    throw new Error('Test data issue: No vehicle found for second dealership');
  }
  
  const vehicleResult = await db.execute(`
    SELECT COUNT(*) as count FROM vehicles WHERE id = $1
  `, [vehicle.id]);
  
  const vehicleCount = parseInt(vehicleResult?.rows?.[0]?.count || '0', 10);
  
  // Try to access a conversation from the second dealership
  const conversation = testData.conversations.find(c => c.dealershipId === dealership2.id);
  if (!conversation) {
    throw new Error('Test data issue: No conversation found for second dealership');
  }
  
  const conversationResult = await db.execute(`
    SELECT COUNT(*) as count FROM conversations WHERE id = $1
  `, [conversation.id]);
  
  const conversationCount = parseInt(conversationResult?.rows?.[0]?.count || '0', 10);
  
  // Clear context
  await clearRlsContext();
  
  // Both counts should be 0 (no access)
  return vehicleCount === 0 && conversationCount === 0;
}

/**
 * Test: RLS prevents direct ID-based access to other dealerships' data
 */
async function testDirectIdAccess(): Promise<boolean> {
  if (testData.dealerships.length < 2) {
    throw new Error('Need at least 2 dealerships for this test');
  }
  
  const dealership1 = testData.dealerships[0];
  const dealership2 = testData.dealerships[1];
  
  // Set context as regular user for the first dealership
  await setupRlsContext(dealership1.id, 'user');
  
  // Try to directly access a vehicle from the second dealership by ID
  const vehicle = testData.vehicles.find(v => v.dealershipId === dealership2.id);
  if (!vehicle) {
    throw new Error('Test data issue: No vehicle found for second dealership');
  }
  
  const vehicleResult = await db.execute(`
    SELECT * FROM vehicles WHERE id = $1
  `, [vehicle.id]);
  
  const vehicleFound = vehicleResult.rows.length > 0;
  
  // Clear context
  await clearRlsContext();
  
  // Should not be able to access the vehicle
  return !vehicleFound;
}

/**
 * Test: No RLS context prevents access to all data
 */
async function testNoContextAccess(): Promise<boolean> {
  // Clear any existing context
  await clearRlsContext();
  
  // Try to query vehicles
  const vehicleResult = await db.execute(`
    SELECT COUNT(*) as count FROM vehicles
  `);
  
  const vehicleCount = parseInt(vehicleResult?.rows?.[0]?.count || '0', 10);
  
  // Try to query conversations
  const conversationResult = await db.execute(`
    SELECT COUNT(*) as count FROM conversations
  `);
  
  const conversationCount = parseInt(conversationResult?.rows?.[0]?.count || '0', 10);
  
  // With no context, should not be able to see any data
  return vehicleCount === 0 && conversationCount === 0;
}

/**
 * Test: Dealership admin can access all data within their dealership
 */
async function testDealershipAdminAccess(): Promise<boolean> {
  const dealership = testData.dealerships[0];
  
  // Set context as dealership_admin for the first dealership
  await setupRlsContext(dealership.id, 'dealership_admin');
  
  // Count vehicles for this dealership
  const expectedVehicleCount = testData.vehicles.filter(
    v => v.dealershipId === dealership.id
  ).length;
  
  // Try to query vehicles
  const vehicleResult = await db.execute(`
    SELECT COUNT(*) as count FROM vehicles
  `);
  
  const vehicleCount = parseInt(vehicleResult?.rows?.[0]?.count || '0', 10);
  
  // Clear context
  await clearRlsContext();
  
  return vehicleCount === expectedVehicleCount;
}

/**
 * Test: RLS functions exist and are properly configured
 */
async function testRlsFunctionsExist(): Promise<boolean> {
  const functions = [
    'set_tenant_context',
    'has_dealership_access',
    'can_modify_record',
    'setup_rls_context'
  ];
  
  let allExist = true;
  
  for (const funcName of functions) {
    const result = await db.execute(`
      SELECT COUNT(*) as count FROM pg_proc 
      WHERE proname = $1
    `, [funcName]);
    
    const count = parseInt(result?.rows?.[0]?.count || '0', 10);
    
    if (count === 0) {
      console.log(chalk.red(`RLS function not found: ${funcName}`));
      allExist = false;
    }
  }
  
  return allExist;
}

/**
 * Main test runner function
 */
async function runRlsTests(): Promise<void> {
  console.log(chalk.yellow('=== ROW LEVEL SECURITY (RLS) VALIDATION TESTS ==='));
  console.log(chalk.yellow('This script tests database-level security isolation'));
  
  try {
    // Create test data
    await createTestData();
    
    // Run tests
    await runTest('RLS is enabled on critical tables', testRlsEnabled);
    await runTest('RLS functions exist and are properly configured', testRlsFunctionsExist);
    await runTest('Super admin can access all dealerships data', testSuperAdminAccess);
    await runTest('Regular user can only access their dealership data', testRegularUserAccess);
    await runTest('Cross-tenant isolation prevents access to other dealerships', testCrossTenantIsolation);
    await runTest('Direct ID-based access to other dealerships is prevented', testDirectIdAccess);
    await runTest('No RLS context prevents access to all data', testNoContextAccess);
    await runTest('Dealership admin can access all data within their dealership', testDealershipAdminAccess);
    
    // Print test summary
    console.log(chalk.yellow('\n=== TEST SUMMARY ==='));
    console.log(chalk.blue(`Total tests: ${testResults.total}`));
    console.log(chalk.green(`Passed: ${testResults.passed}`));
    console.log(chalk.red(`Failed: ${testResults.failed}`));
    
    if (testResults.failed === 0) {
      console.log(chalk.green('\n✅ ALL RLS TESTS PASSED - Tenant isolation is properly enforced'));
    } else {
      console.log(chalk.red('\n❌ SOME RLS TESTS FAILED - Tenant isolation may be compromised'));
      console.log(chalk.red('Review the test results and fix any issues before deploying to production'));
    }
  } catch (error) {
    console.error(chalk.red('Error running RLS tests:'), error);
  } finally {
    // Clean up test data if configured
    if (TEST_CONFIG.cleanupAfterTest) {
      await cleanupTestData();
    } else {
      console.log(chalk.yellow('\nTest data was not cleaned up (for debugging)'));
      console.log(chalk.yellow('Run the following to clean up manually:'));
      console.log(chalk.yellow('npx tsx scripts/cleanup-rls-test-data.ts'));
    }
  }
}

// Run the tests
runRlsTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
