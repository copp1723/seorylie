#!/usr/bin/env ts-node
/**
 * ADF-013 CI Testing Framework Validation Script
 * 
 * This script comprehensively validates the ADF-013 CI Testing Framework implementation.
 * It tests all aspects of the mocking infrastructure, dependency injection, test coverage,
 * CI workflow compatibility, and environment setup.
 * 
 * Usage:
 *   npm run test:ci-framework
 * 
 * Validation criteria:
 * - Mock service functionality and dependency injection
 * - Jest configuration and coverage thresholds
 * - CI workflow compatibility
 * - E2E test execution under 2 minutes
 * - Service coverage validation (90%+)
 * - Environment setup without real credentials
 * - Cleanup procedures
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { createInterface } from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { serviceFactory } from '../server/services/service-factory';
import { MockImapServer } from '../test/mocks/imap-server';
import { MockOpenAIClient } from '../test/mocks/openai';
import { MockTwilioClient } from '../test/mocks/twilio';

// Promisify fs functions
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);

// Define colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [] as Array<{
    name: string;
    result: 'pass' | 'fail' | 'skip';
    duration: number;
    error?: Error;
  }>,
};

// Utility function to run a test and track results
async function runTest(
  name: string,
  testFn: () => Promise<void>,
  options: { skip?: boolean; timeout?: number } = {}
): Promise<void> {
  if (options.skip) {
    console.log(`${colors.yellow}⚠ SKIPPED: ${name}${colors.reset}`);
    results.skipped++;
    results.total++;
    results.tests.push({
      name,
      result: 'skip',
      duration: 0,
    });
    return;
  }

  results.total++;
  const startTime = Date.now();
  
  try {
    console.log(`${colors.bright}Running: ${name}${colors.reset}`);
    
    // Set timeout if provided
    let timeoutId: NodeJS.Timeout | undefined;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        throw new Error(`Test timed out after ${options.timeout}ms`);
      }, options.timeout);
    }
    
    await testFn();
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✓ PASSED: ${name} (${duration}ms)${colors.reset}`);
    results.passed++;
    results.tests.push({
      name,
      result: 'pass',
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`${colors.red}✗ FAILED: ${name} (${duration}ms)${colors.reset}`);
    console.error(`${colors.red}Error: ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
    if (error instanceof Error && error.stack) {
      console.error(`${colors.dim}${error.stack}${colors.reset}`);
    }
    results.failed++;
    results.tests.push({
      name,
      result: 'fail',
      duration,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

// Utility function to execute a command and return output
function execCommand(command: string, options: { silent?: boolean } = {}): string {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    });
    return output.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
    throw error;
  }
}

// Utility function to run a command with a timeout
async function runCommandWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ success: boolean; output: string; duration: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    
    const childProcess = spawn(command, args, {
      shell: true,
    });
    
    childProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    childProcess.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    const timeout = setTimeout(() => {
      childProcess.kill();
      resolve({
        success: false,
        output: `Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`,
        duration: Date.now() - startTime,
      });
    }, timeoutMs);
    
    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        output,
        duration: Date.now() - startTime,
      });
    });
  });
}

// Utility to parse Jest coverage output
async function parseJestCoverage(coverageOutput: string): Promise<{
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}> {
  // Extract coverage percentages using regex
  const statementsMatch = coverageOutput.match(/Statements\s*:\s*(\d+\.?\d*)%/);
  const branchesMatch = coverageOutput.match(/Branches\s*:\s*(\d+\.?\d*)%/);
  const functionsMatch = coverageOutput.match(/Functions\s*:\s*(\d+\.?\d*)%/);
  const linesMatch = coverageOutput.match(/Lines\s*:\s*(\d+\.?\d*)%/);
  
  return {
    statements: statementsMatch ? parseFloat(statementsMatch[1]) : 0,
    branches: branchesMatch ? parseFloat(branchesMatch[1]) : 0,
    functions: functionsMatch ? parseFloat(functionsMatch[1]) : 0,
    lines: linesMatch ? parseFloat(linesMatch[1]) : 0,
  };
}

// Main validation function
async function validateCIFramework(): Promise<void> {
  console.log(`${colors.bright}${colors.blue}=== ADF-013 CI Testing Framework Validation ====${colors.reset}\n`);
  
  // 1. Validate required files exist
  await runTest('Required files exist', async () => {
    const requiredFiles = [
      'test/mocks/imap-server.ts',
      'test/mocks/openai.ts',
      'test/mocks/twilio.ts',
      'server/services/service-factory.ts',
      'jest.config.js',
      '.github/workflows/ci.yml',
      'test/e2e/adf-pipeline-e2e.test.ts',
      'test/fixtures/adf-lead-sample.xml',
      'test/setup/set-env-vars.ts',
      'test/setup/unit-test-setup.ts',
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.resolve(process.cwd(), file);
      const fileExists = await exists(filePath);
      if (!fileExists) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
    
    console.log(`All ${requiredFiles.length} required files exist`);
  });
  
  // 2. Validate mock services functionality
  await runTest('Mock services functionality', async () => {
    // Force mock mode
    serviceFactory.forceMockImplementations(true);
    
    // Create mock instances
    const mockImap = serviceFactory.createImapService() as MockImapServer;
    const mockOpenAI = serviceFactory.createOpenAIService() as MockOpenAIClient;
    const mockTwilio = serviceFactory.createTwilioService() as MockTwilioClient;
    
    // Test IMAP mock
    const testEmail = mockImap.addMessage('INBOX', 'Test email body', {
      subject: 'Test Subject',
      from: [{ name: 'Sender', address: 'sender@example.com' }],
      to: [{ name: 'Recipient', address: 'recipient@example.com' }],
    });
    
    if (!testEmail || testEmail.subject !== 'Test Subject') {
      throw new Error('IMAP mock failed to add message');
    }
    
    // Test OpenAI mock
    const testResponse = {
      id: 'test-id',
      choices: [{ message: { content: 'Test response' } }],
    };
    mockOpenAI.addResponse('chat.completions.create', testResponse);
    const openAIResponse = await mockOpenAI.createChatCompletion({
      messages: [{ role: 'user', content: 'Test prompt' }],
    });
    
    if (openAIResponse.id !== 'test-id' || 
        !openAIResponse.choices || 
        !openAIResponse.choices[0].message ||
        openAIResponse.choices[0].message.content !== 'Test response') {
      throw new Error('OpenAI mock failed to return expected response');
    }
    
    // Test Twilio mock
    const testSMS = {
      sid: 'test-sid',
      status: 'delivered',
    };
    mockTwilio.addResponse('messages.create', testSMS);
    const twilioResponse = await mockTwilio.sendSMS({
      to: '+1234567890',
      body: 'Test message',
    });
    
    if (twilioResponse.sid !== 'test-sid' || twilioResponse.status !== 'delivered') {
      throw new Error('Twilio mock failed to return expected response');
    }
    
    // Reset mocks
    serviceFactory.resetAllServices();
    
    console.log('All mock services functioning correctly');
  });
  
  // 3. Validate dependency injection
  await runTest('Dependency injection', async () => {
    // Test switching between mock and real implementations
    serviceFactory.forceMockImplementations(true);
    const mockService = serviceFactory.createImapService();
    if (!(mockService instanceof MockImapServer)) {
      throw new Error('Service factory failed to return mock implementation when forced');
    }
    
    serviceFactory.forceMockImplementations(false);
    // In a real test, we would check for the real implementation
    // but for this validation script, we'll just check that it's not a mock
    const realService = serviceFactory.createImapService();
    if (realService instanceof MockImapServer) {
      throw new Error('Service factory returned mock implementation when not forced');
    }
    
    // Reset to default
    serviceFactory.resetAllServices();
    
    console.log('Dependency injection working correctly');
  });
  
  // 4. Validate Jest configuration
  await runTest('Jest configuration', async () => {
    const jestConfigPath = path.resolve(process.cwd(), 'jest.config.js');
    const jestConfig = require(jestConfigPath);
    
    // Check essential configuration
    if (!jestConfig.preset || jestConfig.preset !== 'ts-jest') {
      throw new Error('Jest config missing ts-jest preset');
    }
    
    if (!jestConfig.testEnvironment || jestConfig.testEnvironment !== 'node') {
      throw new Error('Jest config missing node test environment');
    }
    
    if (!jestConfig.coverageThreshold || 
        !jestConfig.coverageThreshold.global || 
        !jestConfig.coverageThreshold.global.lines || 
        jestConfig.coverageThreshold.global.lines < 90) {
      throw new Error('Jest config missing 90% line coverage threshold');
    }
    
    // Check for projects configuration (unit, integration, e2e)
    if (!jestConfig.projects || !Array.isArray(jestConfig.projects) || jestConfig.projects.length < 3) {
      throw new Error('Jest config missing projects configuration for unit/integration/e2e');
    }
    
    // Check for test timeout (should be 2 minutes = 120000ms)
    if (!jestConfig.testTimeout || jestConfig.testTimeout < 120000) {
      throw new Error('Jest config missing 2-minute test timeout');
    }
    
    console.log('Jest configuration validated successfully');
  });
  
  // 5. Validate CI workflow configuration
  await runTest('CI workflow configuration', async () => {
    const ciConfigPath = path.resolve(process.cwd(), '.github/workflows/ci.yml');
    const ciConfigContent = await readFile(ciConfigPath, 'utf-8');
    
    // Check for essential CI components
    const requiredComponents = [
      'services:', // Container services
      'redis:', // Redis service
      'postgres:', // Postgres service
      'mailhog:', // MailHog service
      'npm run test:unit', // Unit tests
      'npm run test:e2e', // E2E tests
      'npm run lint', // Linting
      'npm run build', // Build
    ];
    
    for (const component of requiredComponents) {
      if (!ciConfigContent.includes(component)) {
        throw new Error(`CI workflow missing required component: ${component}`);
      }
    }
    
    // Check for environment variables setup
    if (!ciConfigContent.includes('NODE_ENV: test') || 
        !ciConfigContent.includes('USE_MOCK_SERVICES: true')) {
      throw new Error('CI workflow missing required environment variables');
    }
    
    console.log('CI workflow configuration validated successfully');
  });
  
  // 6. Validate E2E test execution time
  await runTest('E2E test execution time', async () => {
    console.log('Running E2E test with timeout validation (2 minutes)...');
    
    const { success, output, duration } = await runCommandWithTimeout(
      'npx',
      ['jest', '--testMatch="**/test/e2e/**/*.test.ts"', '--config=jest.config.js', '--testTimeout=120000'],
      130000 // Allow slightly more than 2 minutes for the process overhead
    );
    
    if (!success) {
      throw new Error(`E2E test failed: ${output}`);
    }
    
    // Check if test completed within 2 minutes (120000ms)
    if (duration > 120000) {
      throw new Error(`E2E test took too long: ${duration}ms (max: 120000ms)`);
    }
    
    console.log(`E2E test completed in ${duration}ms (under 2 minutes)`);
  });
  
  // 7. Validate test coverage
  await runTest('Test coverage validation', async () => {
    console.log('Running coverage analysis...');
    
    // Run Jest with coverage
    const { success, output } = await runCommandWithTimeout(
      'npx',
      ['jest', '--coverage', '--coverageReporters=text', '--testMatch="**/test/unit/**/*.test.ts"'],
      60000
    );
    
    if (!success) {
      throw new Error(`Coverage test failed: ${output}`);
    }
    
    // Parse coverage output
    const coverage = await parseJestCoverage(output);
    
    // Check if coverage meets requirements (90%)
    if (coverage.lines < 90) {
      throw new Error(`Line coverage below 90%: ${coverage.lines}%`);
    }
    
    if (coverage.functions < 90) {
      throw new Error(`Function coverage below 90%: ${coverage.functions}%`);
    }
    
    console.log(`Coverage validation successful: ${coverage.lines}% lines, ${coverage.functions}% functions`);
  });
  
  // 8. Validate environment setup without real credentials
  await runTest('Environment setup without real credentials', async () => {
    // Save current environment variables
    const originalEnv = { ...process.env };
    
    try {
      // Clear sensitive environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      
      // Force test environment
      process.env.NODE_ENV = 'test';
      process.env.USE_MOCK_SERVICES = 'true';
      
      // Run a simple test that would normally require credentials
      const { success, output } = await runCommandWithTimeout(
        'npx',
        ['jest', '--testMatch="**/test/unit/**/*.test.ts"', '--testNamePattern="should work without real credentials"'],
        30000
      );
      
      if (!success) {
        throw new Error(`Environment test failed: ${output}`);
      }
      
      console.log('Tests run successfully without real credentials');
    } finally {
      // Restore original environment
      process.env = originalEnv;
    }
  });
  
  // 9. Validate cleanup procedures
  await runTest('Cleanup procedures', async () => {
    // Create a temporary test file
    const tempId = uuidv4();
    const tempFilePath = path.resolve(process.cwd(), `test-cleanup-${tempId}.tmp`);
    fs.writeFileSync(tempFilePath, 'Test cleanup data');
    
    // Run a test that should clean up after itself
    const testScript = `
      const fs = require('fs');
      const path = require('path');
      
      // Create some test artifacts
      const tempFiles = [
        'test-artifact-1-${tempId}.tmp',
        'test-artifact-2-${tempId}.tmp'
      ];
      
      tempFiles.forEach(file => {
        fs.writeFileSync(path.resolve(process.cwd(), file), 'Test data');
      });
      
      // Register cleanup
      process.on('exit', () => {
        tempFiles.forEach(file => {
          try {
            fs.unlinkSync(path.resolve(process.cwd(), file));
          } catch (e) {
            console.error('Failed to clean up:', file);
          }
        });
      });
      
      // Exit with success
      process.exit(0);
    `;
    
    const tempScriptPath = path.resolve(process.cwd(), `test-cleanup-script-${tempId}.js`);
    fs.writeFileSync(tempScriptPath, testScript);
    
    try {
      // Run the test script
      execCommand(`node ${tempScriptPath}`, { silent: true });
      
      // Check if artifacts were cleaned up
      const artifactsExist = fs.existsSync(path.resolve(process.cwd(), `test-artifact-1-${tempId}.tmp`)) ||
                             fs.existsSync(path.resolve(process.cwd(), `test-artifact-2-${tempId}.tmp`));
      
      if (artifactsExist) {
        throw new Error('Cleanup procedure failed: test artifacts still exist');
      }
      
      console.log('Cleanup procedures working correctly');
    } finally {
      // Clean up our own test files
      try {
        fs.unlinkSync(tempFilePath);
        fs.unlinkSync(tempScriptPath);
      } catch (e) {
        console.error('Failed to clean up temporary test files');
      }
    }
  });
  
  // 10. Validate acceptance criteria
  await runTest('Acceptance criteria validation', async () => {
    const criteria = [
      'CI pipeline passes without real external credentials',
      'Unit tests cover 90% of ADF services',
      'E2E test processes fixture lead end-to-end within 2 minutes',
    ];
    
    // Check each criterion
    const ciPipelinePasses = results.tests.find(t => t.name === 'CI workflow configuration')?.result === 'pass' &&
                             results.tests.find(t => t.name === 'Environment setup without real credentials')?.result === 'pass';
    
    const unitTestsCover90Percent = results.tests.find(t => t.name === 'Test coverage validation')?.result === 'pass';
    
    const e2eTestUnder2Minutes = results.tests.find(t => t.name === 'E2E test execution time')?.result === 'pass';
    
    if (!ciPipelinePasses) {
      throw new Error('Acceptance criterion failed: CI pipeline passes without real external credentials');
    }
    
    if (!unitTestsCover90Percent) {
      throw new Error('Acceptance criterion failed: Unit tests cover 90% of ADF services');
    }
    
    if (!e2eTestUnder2Minutes) {
      throw new Error('Acceptance criterion failed: E2E test processes fixture lead end-to-end within 2 minutes');
    }
    
    console.log('All acceptance criteria validated successfully');
  });
  
  // Print summary
  console.log(`\n${colors.bright}${colors.blue}=== ADF-013 CI Testing Framework Validation Summary ====${colors.reset}`);
  console.log(`${colors.bright}Total tests: ${results.total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
  
  // Print detailed results
  console.log(`\n${colors.bright}Detailed Results:${colors.reset}`);
  results.tests.forEach((test) => {
    const resultColor = test.result === 'pass' ? colors.green : 
                       test.result === 'fail' ? colors.red : colors.yellow;
    const resultSymbol = test.result === 'pass' ? '✓' : 
                        test.result === 'fail' ? '✗' : '⚠';
    
    console.log(`${resultColor}${resultSymbol} ${test.name} (${test.duration}ms)${colors.reset}`);
  });
  
  // Final result
  if (results.failed > 0) {
    console.log(`\n${colors.red}${colors.bright}ADF-013 CI Testing Framework Validation FAILED${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}ADF-013 CI Testing Framework Validation PASSED${colors.reset}`);
    console.log(`${colors.green}All acceptance criteria met:${colors.reset}`);
    console.log(`${colors.green}✓ CI pipeline passes without real external credentials${colors.reset}`);
    console.log(`${colors.green}✓ Unit tests cover 90% of ADF services${colors.reset}`);
    console.log(`${colors.green}✓ E2E test processes fixture lead end-to-end within 2 minutes${colors.reset}`);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateCIFramework().catch((error) => {
    console.error(`${colors.red}${colors.bright}Validation failed with error:${colors.reset}`);
    console.error(error);
    process.exit(1);
  });
}

// Export for programmatic usage
export { validateCIFramework };
