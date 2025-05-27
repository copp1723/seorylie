/**
 * This script checks for required environment variables and database connectivity
 * Run this before deployment to ensure the system is properly configured
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

// Required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'OPENAI_API_KEY',
  'SENDGRID_API_KEY',
  'REPLIT_DOMAINS'
];

// Optional environment variables with defaults
const optionalEnvVars = [
  'NODE_ENV'
];

async function checkEnvironment() {
  console.log('🔍 Checking environment configuration...\n');

  // Check required environment variables
  console.log('REQUIRED ENVIRONMENT VARIABLES:');
  let missingVars = false;

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.log(`❌ ${envVar} is missing`);
      missingVars = true;
    } else {
      // Don't show the actual value for security reasons
      console.log(`✅ ${envVar} is set`);
    }
  }

  // Check optional environment variables
  console.log('\nOPTIONAL ENVIRONMENT VARIABLES:');
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      console.log(`⚠️ ${envVar} is not set (optional)`);
    } else {
      console.log(`✅ ${envVar} is set to "${process.env[envVar]}"`);
    }
  }

  // Check database connection
  console.log('\nDATABASE CONNECTION:');
  try {
    // Execute a simple query to verify connection
    const result = await db.execute(sql`SELECT NOW() as time`);
    console.log(`✅ Database connection successful (${result[0].time})`);

    // Check for required tables
    console.log('\nDATABASE TABLES:');
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    const requiredTables = ['sessions', 'users', 'dealerships', 'vehicles', 'personas', 'api_keys'];
    const existingTables = tables.map(row => row.table_name);

    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' is missing`);
      }
    }

  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
  }

  // Check for additional services
  console.log('\nEXTERNAL SERVICE CONFIGURATION:');

  // Check OpenAI key format (simple validation, doesn't verify if it works)
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (openaiKey.startsWith('sk-') && openaiKey.length > 20) {
    console.log('✅ OpenAI API key format looks valid');
  } else {
    console.log('⚠️ OpenAI API key format may be invalid');
  }

  // Check SendGrid key format (simple validation, doesn't verify if it works)
  const sendgridKey = process.env.SENDGRID_API_KEY || '';
  if (sendgridKey.length > 20) {
    console.log('✅ SendGrid API key format looks valid');
  } else {
    console.log('⚠️ SendGrid API key format may be invalid');
  }

  // Summary
  console.log('\n🔍 ENVIRONMENT CHECK SUMMARY:');
  if (missingVars) {
    console.log('❌ Some required environment variables are missing.');
    console.log('   Please set them before deploying.');
  } else {
    console.log('✅ All required environment variables are set.');
  }

  console.log('\n📋 NEXT STEPS:');
  console.log('1. Run database setup script if not already done:');
  console.log('   npx tsx scripts/setup-database.ts');
  console.log('2. Create test data if needed:');
  console.log('   npx tsx scripts/test-setup.ts');
  console.log('3. Start the application:');
  console.log('   npm run dev (development) or npm run start (production)');
}

// Run the check
checkEnvironment()
  .then(() => {
    console.log('\nEnvironment check completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during environment check:', error);
    process.exit(1);
  });