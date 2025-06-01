import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test environment cleanup...');
  
  try {
    // Generate test report
    await generateTestReport();
    
    console.log('✅ E2E test environment cleanup complete');
  } catch (error) {
    console.error('❌ Error during E2E test environment cleanup:', error);
    // Don't throw error to allow tests to complete
    console.error('Continuing despite cleanup errors');
  }
}

/**
 * Generates a test report
 */
async function generateTestReport() {
  console.log('📊 Generating E2E test report...');
  
  const timestamp = new Date().toISOString();
  console.log(`Test execution completed at: ${timestamp}`);
  console.log('📝 Full report available in playwright-report directory');
}

export default globalTeardown;
