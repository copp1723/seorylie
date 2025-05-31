#!/usr/bin/env tsx
/**
 * Comprehensive Test Execution Script
 * 
 * Runs a complete test suite including:
 * - Unit tests
 * - Integration tests  
 * - End-to-End tests
 * - Load tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('🚀 Starting Comprehensive Testing Suite\n');
  
  const startTime = Date.now();
  let hasFailures = false;
  
  try {
    // Run unit tests
    console.log('📋 Running unit tests...');
    try {
      await execAsync('npm run test:unit');
      console.log('✅ Unit tests passed\n');
    } catch (error) {
      console.error('❌ Unit tests failed\n');
      hasFailures = true;
    }
    
    // Run integration tests
    console.log('🔗 Running integration tests...');
    try {
      await execAsync('npm run test:integration');
      console.log('✅ Integration tests passed\n');
    } catch (error) {
      console.error('❌ Integration tests failed\n');
      hasFailures = true;
    }
    
    // Run E2E tests
    console.log('🌐 Running E2E tests...');
    try {
      await execAsync('npx playwright test');
      console.log('✅ E2E tests passed\n');
    } catch (error) {
      console.error('❌ E2E tests failed\n');
      hasFailures = true;
    }
    
    // Run load tests
    console.log('🏋️ Running load tests...');
    try {
      await execAsync('npm run test:load');
      console.log('✅ Load tests passed\n');
    } catch (error) {
      console.error('❌ Load tests failed\n');
      hasFailures = true;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Testing completed in ${duration}s`);
    
    if (hasFailures) {
      console.log('❌ Some tests failed - check output above');
      process.exit(1);
    } else {
      console.log('🎉 All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

main();
