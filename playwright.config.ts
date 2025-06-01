import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.example';
if (fs.existsSync(path.join(__dirname, envFile))) {
  dotenv.config({ path: path.join(__dirname, envFile) });
}

// Base URL for tests
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory and file pattern
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  
  // Maximum time one test can run for
  timeout: 120000,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['list'],
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL to use in navigation
    baseURL: BASE_URL,
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Capture screenshot after each test
    screenshot: 'only-on-failure',
    
    // Record video for failed tests
    video: 'on-first-retry',
  },
  
  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  
  // Global setup to authenticate and prepare test environment
  globalSetup: require.resolve('./test/e2e/global-setup.ts'),
  
  // Folder for test artifacts like screenshots and videos
  outputDir: 'test-results/',
  
  // Global teardown
  globalTeardown: require.resolve('./test/e2e/global-teardown.ts'),
});
