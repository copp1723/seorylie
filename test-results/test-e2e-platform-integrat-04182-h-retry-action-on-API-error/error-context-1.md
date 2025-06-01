# Test info

- Name: Platform Integration E2E Tests >> ActionableToast Component >> should display toast with retry action on API error
- Location: /Users/copp1723/cleanrylie/test/e2e/platform-integration.spec.ts:143:9

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

    at login (/Users/copp1723/cleanrylie/test/e2e/platform-integration.spec.ts:34:14)
    at /Users/copp1723/cleanrylie/test/e2e/platform-integration.spec.ts:126:11
```

# Test source

```ts
   1 | import { test, expect, Page, Locator, BrowserContext } from '@playwright/test';
   2 | import { readFileSync } from 'fs';
   3 | import { join } from 'path';
   4 | import AxeBuilder from '@axe-core/playwright';
   5 |
   6 | // Test constants
   7 | const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
   8 | const TEST_USER = {
   9 |   email: process.env.TEST_USER_EMAIL || 'test@example.com',
   10 |   password: process.env.TEST_USER_PASSWORD || 'testpassword',
   11 | };
   12 | const ADMIN_USER = {
   13 |   email: process.env.ADMIN_USER_EMAIL || 'admin@example.com',
   14 |   password: process.env.ADMIN_USER_PASSWORD || 'adminpassword',
   15 | };
   16 | const RESTRICTED_USER = {
   17 |   email: process.env.RESTRICTED_USER_EMAIL || 'restricted@example.com',
   18 |   password: process.env.RESTRICTED_USER_PASSWORD || 'restrictedpassword',
   19 | };
   20 |
   21 | // Viewport sizes for responsive testing
   22 | const VIEWPORTS = {
   23 |   mobile: { width: 375, height: 667 },
   24 |   tablet: { width: 768, height: 1024 },
   25 |   desktop: { width: 1280, height: 800 },
   26 |   widescreen: { width: 1920, height: 1080 },
   27 | };
   28 |
   29 | // Test timeout for long-running tests
   30 | const TEST_TIMEOUT = 120000;
   31 |
   32 | // Helper functions
   33 | async function login(page: Page, user = TEST_USER) {
>  34 |   await page.goto(`${BASE_URL}/login`);
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
   35 |   await page.getByLabel('Email').fill(user.email);
   36 |   await page.getByLabel('Password').fill(user.password);
   37 |   await page.getByRole('button', { name: 'Sign In' }).click();
   38 |   await page.waitForURL(`${BASE_URL}/dashboard`);
   39 | }
   40 |
   41 | async function createSandbox(page: Page, name = `Test Sandbox ${Date.now()}`) {
   42 |   await page.goto(`${BASE_URL}/sandboxes`);
   43 |   await page.getByRole('button', { name: 'Create Sandbox' }).click();
   44 |   await page.getByLabel('Sandbox Name').fill(name);
   45 |   await page.getByRole('button', { name: 'Create' }).click();
   46 |   
   47 |   // Wait for sandbox to be created and get its ID
   48 |   await page.waitForSelector('[data-testid="sandbox-item"]');
   49 |   const sandboxId = await page.locator('[data-testid="sandbox-item"]').first().getAttribute('data-sandbox-id');
   50 |   return sandboxId;
   51 | }
   52 |
   53 | async function toggleDarkMode(page: Page) {
   54 |   await page.getByRole('button', { name: 'Toggle theme' }).click();
   55 | }
   56 |
   57 | async function forceError(page: Page) {
   58 |   // Navigate to a page that has a button to force an error
   59 |   await page.goto(`${BASE_URL}/debug`);
   60 |   await page.getByRole('button', { name: 'Force Error' }).click();
   61 | }
   62 |
   63 | async function waitForToast(page: Page) {
   64 |   return await page.waitForSelector('[role="status"]', { timeout: 5000 });
   65 | }
   66 |
   67 | async function waitForWebSocketConnection(page: Page) {
   68 |   // Wait for WebSocket connection indicator
   69 |   await page.waitForSelector('[data-testid="ws-connected"]', { timeout: 10000 });
   70 | }
   71 |
   72 | async function measurePageLoad(page: Page, url: string) {
   73 |   // Navigate to the page and measure load time
   74 |   const startTime = Date.now();
   75 |   await page.goto(url);
   76 |   const loadTime = Date.now() - startTime;
   77 |   return loadTime;
   78 | }
   79 |
   80 | async function toggleFeatureFlag(page: Page, flagName: string, enabled: boolean) {
   81 |   // Navigate to admin feature flags page
   82 |   await page.goto(`${BASE_URL}/admin/feature-flags`);
   83 |   
   84 |   // Find the feature flag toggle
   85 |   const flagToggle = page.locator(`[data-feature-flag="${flagName}"]`);
   86 |   
   87 |   // Get current state
   88 |   const isCurrentlyEnabled = await flagToggle.isChecked();
   89 |   
   90 |   // Toggle if needed
   91 |   if (isCurrentlyEnabled !== enabled) {
   92 |     await flagToggle.click();
   93 |     // Wait for save confirmation
   94 |     await page.waitForSelector('[data-testid="flag-updated"]');
   95 |   }
   96 | }
   97 |
   98 | // Test fixtures
   99 | test.describe('Platform Integration E2E Tests', () => {
  100 |   let sandboxId: string;
  101 |   
  102 |   test.beforeAll(async ({ browser }) => {
  103 |     // Set up global test data
  104 |     const context = await browser.newContext();
  105 |     const page = await context.newPage();
  106 |     
  107 |     // Login and create a test sandbox
  108 |     await login(page, ADMIN_USER);
  109 |     sandboxId = await createSandbox(page);
  110 |     
  111 |     // Ensure all feature flags are enabled for testing
  112 |     await toggleFeatureFlag(page, 'enable-redis-websocket-scaling', true);
  113 |     await toggleFeatureFlag(page, 'enable-sandbox-pause-resume', true);
  114 |     await toggleFeatureFlag(page, 'enable-kpi-caching', true);
  115 |     await toggleFeatureFlag(page, 'enable-global-error-handling', true);
  116 |     await toggleFeatureFlag(page, 'enable-error-ux-improvements', true);
  117 |     
  118 |     await context.close();
  119 |   });
  120 |   
  121 |   test.afterAll(async ({ browser }) => {
  122 |     // Clean up test data
  123 |     const context = await browser.newContext();
  124 |     const page = await context.newPage();
  125 |     
  126 |     await login(page, ADMIN_USER);
  127 |     
  128 |     // Delete test sandbox
  129 |     await page.goto(`${BASE_URL}/sandboxes`);
  130 |     await page.locator(`[data-sandbox-id="${sandboxId}"] [data-testid="delete-sandbox"]`).click();
  131 |     await page.getByRole('button', { name: 'Confirm' }).click();
  132 |     
  133 |     await context.close();
  134 |   });
```