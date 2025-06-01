import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test environment setup...');
  
  try {
    // Validate environment
    await validateEnvironment();
    
    console.log('✅ E2E test environment setup complete');
  } catch (error) {
    console.error('❌ Error during E2E test environment setup:', error);
    throw error;
  }
}

/**
 * Validates the test environment
 */
async function validateEnvironment() {
  console.log('🔍 Validating test environment...');
  
  // Check for required environment variables
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'OPENAI_API_KEY',
    'SENDGRID_API_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using mock values for testing purposes');
    
    // Set mock values for testing
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rylie_test';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';
    process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'SG.test-key';
  }
  
  // Check if server is running
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log('✅ Server is running');
    } else {
      console.warn('⚠️ Server health check failed');
    }
  } catch (error) {
    console.warn('⚠️ Server not running - tests may need manual server start');
  }
}

export default globalSetup;
