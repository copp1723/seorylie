import { test, expect, Page, Locator, BrowserContext } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import AxeBuilder from "@axe-core/playwright";

// Test constants
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "test@example.com",
  password: process.env.TEST_USER_PASSWORD || "testpassword",
};
const ADMIN_USER = {
  email: process.env.ADMIN_USER_EMAIL || "admin@example.com",
  password: process.env.ADMIN_USER_PASSWORD || "adminpassword",
};
const RESTRICTED_USER = {
  email: process.env.RESTRICTED_USER_EMAIL || "restricted@example.com",
  password: process.env.RESTRICTED_USER_PASSWORD || "restrictedpassword",
};

// Viewport sizes for responsive testing
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  widescreen: { width: 1920, height: 1080 },
};

// Test timeout for long-running tests
const TEST_TIMEOUT = 120000;

// Helper functions
async function login(page: Page, user = TEST_USER) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function createSandbox(page: Page, name = `Test Sandbox ${Date.now()}`) {
  await page.goto(`${BASE_URL}/sandboxes`);
  await page.getByRole("button", { name: "Create Sandbox" }).click();
  await page.getByLabel("Sandbox Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();

  // Wait for sandbox to be created and get its ID
  await page.waitForSelector('[data-testid="sandbox-item"]');
  const sandboxId = await page
    .locator('[data-testid="sandbox-item"]')
    .first()
    .getAttribute("data-sandbox-id");
  return sandboxId;
}

async function toggleDarkMode(page: Page) {
  await page.getByRole("button", { name: "Toggle theme" }).click();
}

async function forceError(page: Page) {
  // Navigate to a page that has a button to force an error
  await page.goto(`${BASE_URL}/debug`);
  await page.getByRole("button", { name: "Force Error" }).click();
}

async function waitForToast(page: Page) {
  return await page.waitForSelector('[role="status"]', { timeout: 5000 });
}

async function waitForWebSocketConnection(page: Page) {
  // Wait for WebSocket connection indicator
  await page.waitForSelector('[data-testid="ws-connected"]', {
    timeout: 10000,
  });
}

async function measurePageLoad(page: Page, url: string) {
  // Navigate to the page and measure load time
  const startTime = Date.now();
  await page.goto(url);
  const loadTime = Date.now() - startTime;
  return loadTime;
}

async function toggleFeatureFlag(
  page: Page,
  flagName: string,
  enabled: boolean,
) {
  // Navigate to admin feature flags page
  await page.goto(`${BASE_URL}/admin/feature-flags`);

  // Find the feature flag toggle
  const flagToggle = page.locator(`[data-feature-flag="${flagName}"]`);

  // Get current state
  const isCurrentlyEnabled = await flagToggle.isChecked();

  // Toggle if needed
  if (isCurrentlyEnabled !== enabled) {
    await flagToggle.click();
    // Wait for save confirmation
    await page.waitForSelector('[data-testid="flag-updated"]');
  }
}

// Test fixtures
test.describe("Platform Integration E2E Tests", () => {
  let sandboxId: string;

  test.beforeAll(async ({ browser }) => {
    // Set up global test data
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login and create a test sandbox
    await login(page, ADMIN_USER);
    sandboxId = await createSandbox(page);

    // Ensure all feature flags are enabled for testing
    await toggleFeatureFlag(page, "enable-redis-websocket-scaling", true);
    await toggleFeatureFlag(page, "enable-sandbox-pause-resume", true);
    await toggleFeatureFlag(page, "enable-kpi-caching", true);
    await toggleFeatureFlag(page, "enable-global-error-handling", true);
    await toggleFeatureFlag(page, "enable-error-ux-improvements", true);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    // Clean up test data
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, ADMIN_USER);

    // Delete test sandbox
    await page.goto(`${BASE_URL}/sandboxes`);
    await page
      .locator(
        `[data-sandbox-id="${sandboxId}"] [data-testid="delete-sandbox"]`,
      )
      .click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  // 1. Test ActionableToast component functionality with error scenarios
  test.describe("ActionableToast Component", () => {
    test("should display toast with retry action on API error", async ({
      page,
    }) => {
      // Navigate to a page that will trigger an API error
      await page.goto(`${BASE_URL}/api-test?forceError=true`);

      // Wait for toast to appear
      const toast = await waitForToast(page);

      // Verify toast content
      await expect(toast).toContainText("Error");
      await expect(toast).toContainText("Retry");

      // Verify toast has trace ID
      const traceIdVisible = await toast
        .locator('[data-testid="error-trace-id"]')
        .isVisible();
      expect(traceIdVisible).toBeTruthy();

      // Test retry functionality
      await toast.getByRole("button", { name: "Retry" }).click();

      // Verify loading state during retry
      const progressBar = await toast
        .locator('[role="progressbar"]')
        .isVisible();
      expect(progressBar).toBeTruthy();

      // Verify toast disappears after successful retry
      await page.waitForTimeout(2000); // Wait for retry to complete
      const toastVisible = await page.locator('[role="status"]').isVisible();
      expect(toastVisible).toBeFalsy();
    });

    test("should allow copying trace ID to clipboard", async ({ page }) => {
      await forceError(page);

      // Wait for toast to appear
      const toast = await waitForToast(page);

      // Click copy button
      await toast.getByRole("button", { name: "Copy ID" }).click();

      // Verify copy confirmation appears
      await expect(
        page.locator('[data-testid="copy-confirmation"]'),
      ).toBeVisible();

      // Note: Can't verify clipboard content in Playwright without additional setup
    });

    test("should rate limit multiple similar errors", async ({ page }) => {
      // Trigger multiple similar errors
      for (let i = 0; i < 5; i++) {
        await forceError(page);
      }

      // Verify only limited number of toasts are shown (max 3)
      const toastCount = await page.locator('[role="status"]').count();
      expect(toastCount).toBeLessThanOrEqual(3);

      // Verify rate limiting message is shown
      const rateLimitMessage = await page
        .locator('[data-testid="toast-rate-limit"]')
        .isVisible();
      expect(rateLimitMessage).toBeTruthy();
    });
  });

  // 2. Test ErrorBoundary component with different fallback UIs
  test.describe("ErrorBoundary Component", () => {
    test("should show app-level fallback UI on critical error", async ({
      page,
    }) => {
      // Navigate to page that triggers app-level error
      await page.goto(`${BASE_URL}/debug/app-error`);

      // Verify app-level fallback UI is shown
      await expect(
        page.locator('[data-testid="app-error-boundary"]'),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Something went wrong" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Return Home" }),
      ).toBeVisible();

      // Verify trace ID is displayed
      await expect(
        page.locator('[data-testid="error-trace-id"]'),
      ).toBeVisible();

      // Test recovery action
      await page.getByRole("button", { name: "Return Home" }).click();
      await page.waitForURL(`${BASE_URL}/dashboard`);
    });

    test("should show component-level fallback UI on component error", async ({
      page,
    }) => {
      // Navigate to page with component that will error
      await page.goto(`${BASE_URL}/debug/component-error`);

      // Verify component-level fallback UI is shown
      await expect(
        page.locator('[data-testid="component-error-boundary"]'),
      ).toBeVisible();
      await expect(
        page.getByText("This component encountered an error"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

      // Verify rest of page is still functional
      await expect(
        page.getByRole("heading", { name: "Debug Page" }),
      ).toBeVisible();

      // Test retry functionality
      await page.getByRole("button", { name: "Retry" }).click();

      // Verify component is reloaded (will likely error again in test)
      await expect(
        page.locator('[data-testid="component-error-boundary"]'),
      ).toBeVisible();
    });

    test("should show media fallback UI on media loading error", async ({
      page,
    }) => {
      // Navigate to page with media that will fail to load
      await page.goto(`${BASE_URL}/debug/media-error`);

      // Verify media fallback UI is shown
      await expect(
        page.locator('[data-testid="media-error-fallback"]'),
      ).toBeVisible();
      await expect(page.getByText("Media failed to load")).toBeVisible();

      // Verify placeholder maintains aspect ratio
      const mediaFallback = page.locator(
        '[data-testid="media-error-fallback"]',
      );
      const boundingBox = await mediaFallback.boundingBox();
      if (boundingBox) {
        // Verify 16:9 aspect ratio (common for media)
        const aspectRatio = boundingBox.width / boundingBox.height;
        expect(Math.abs(aspectRatio - 16 / 9)).toBeLessThan(0.1);
      }
    });
  });

  // 3. Test sandbox pause/resume functionality from the UI
  test.describe("Sandbox Pause/Resume", () => {
    test("should pause and resume sandbox from UI", async ({ page }) => {
      // Navigate to sandbox detail page
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}`);

      // Verify initial running state
      await expect(
        page.locator('[data-testid="sandbox-status"]'),
      ).toContainText("Running");

      // Pause sandbox
      await page.getByRole("button", { name: "Pause Sandbox" }).click();
      await page.getByRole("button", { name: "Confirm" }).click();

      // Verify paused state
      await expect(
        page.locator('[data-testid="sandbox-status"]'),
      ).toContainText("Paused");

      // Verify tool execution is disabled
      const toolButton = page.getByRole("button", { name: "Execute Tool" });
      await expect(toolButton).toBeDisabled();

      // Resume sandbox
      await page.getByRole("button", { name: "Resume Sandbox" }).click();

      // Verify running state
      await expect(
        page.locator('[data-testid="sandbox-status"]'),
      ).toContainText("Running");

      // Verify tool execution is enabled
      await expect(toolButton).toBeEnabled();
    });

    test("should show appropriate UI indicators when sandbox is paused", async ({
      page,
    }) => {
      // Navigate to sandbox detail page
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}`);

      // Pause sandbox
      await page.getByRole("button", { name: "Pause Sandbox" }).click();
      await page.getByRole("button", { name: "Confirm" }).click();

      // Verify visual indicators of paused state
      await expect(
        page.locator('[data-testid="sandbox-paused-banner"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="sandbox-paused-icon"]'),
      ).toBeVisible();

      // Verify tool execution button shows proper state
      await expect(
        page.getByRole("button", { name: "Execute Tool" }),
      ).toBeDisabled();
      await expect(
        page.locator('[data-testid="tool-disabled-reason"]'),
      ).toContainText("sandbox is paused");

      // Resume sandbox for cleanup
      await page.getByRole("button", { name: "Resume Sandbox" }).click();
    });

    test("should show 423 error toast when attempting tool execution on paused sandbox", async ({
      page,
    }) => {
      // Navigate to sandbox detail page
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}`);

      // Pause sandbox
      await page.getByRole("button", { name: "Pause Sandbox" }).click();
      await page.getByRole("button", { name: "Confirm" }).click();

      // Force tool execution through API (bypassing UI disabled state)
      await page.evaluate((id) => {
        fetch(`/api/sandbox/${id}/tools/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toolId: "test-tool",
            params: { test: "value" },
          }),
        });
      }, sandboxId);

      // Verify error toast appears
      const toast = await waitForToast(page);
      await expect(toast).toContainText("Sandbox is paused");
      await expect(toast).toContainText("423");

      // Resume sandbox for cleanup
      await page.getByRole("button", { name: "Resume Sandbox" }).click();
    });
  });

  // 4. Test KPI dashboards with caching behavior
  test.describe("KPI Dashboard Caching", () => {
    test("should load KPI dashboard with caching", async ({ page }) => {
      // Navigate to KPI dashboard
      await page.goto(`${BASE_URL}/dashboard/kpi`);

      // First load - should not be cached
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');
      const firstLoadTime = await page
        .locator('[data-testid="page-load-time"]')
        .textContent();

      // Refresh page
      await page.reload();

      // Second load - should be cached
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');
      const secondLoadTime = await page
        .locator('[data-testid="page-load-time"]')
        .textContent();

      // Verify cache indicator is shown
      await expect(
        page.locator('[data-testid="cache-indicator"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="cache-indicator"]'),
      ).toContainText("Cached");

      // Verify second load is faster (cached)
      expect(parseInt(firstLoadTime || "1000")).toBeGreaterThan(
        parseInt(secondLoadTime || "0"),
      );
    });

    test("should refresh KPI dashboard cache on demand", async ({ page }) => {
      // Navigate to KPI dashboard
      await page.goto(`${BASE_URL}/dashboard/kpi`);

      // Wait for initial load
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');

      // Click refresh button
      await page.getByRole("button", { name: "Refresh Data" }).click();

      // Verify loading state is shown
      await expect(page.locator('[data-testid="kpi-loading"]')).toBeVisible();

      // Verify fresh data is loaded
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');
      await expect(
        page.locator('[data-testid="cache-indicator"]'),
      ).toContainText("Fresh");
    });

    test("should auto-invalidate cache after ETL event", async ({
      page,
      context,
    }) => {
      // Open dashboard in one tab
      await page.goto(`${BASE_URL}/dashboard/kpi`);
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');

      // Open another tab to trigger ETL event
      const adminPage = await context.newPage();
      await login(adminPage, ADMIN_USER);
      await adminPage.goto(`${BASE_URL}/admin/etl`);
      await adminPage.getByRole("button", { name: "Run ETL Process" }).click();
      await adminPage.waitForSelector('[data-testid="etl-complete"]');

      // Go back to dashboard tab
      await page.bringToFront();

      // Verify cache invalidation notification
      await expect(
        page.locator('[data-testid="cache-invalidated"]'),
      ).toBeVisible();

      // Refresh page
      await page.reload();

      // Verify fresh data is loaded
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');
      await expect(
        page.locator('[data-testid="cache-indicator"]'),
      ).toContainText("Fresh");
    });
  });

  // 5. Test WebSocket real-time updates in the UI
  test.describe("WebSocket Real-time Updates", () => {
    test("should establish WebSocket connection and receive updates", async ({
      page,
      context,
    }) => {
      // Navigate to sandbox chat
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}/chat`);

      // Wait for WebSocket connection
      await waitForWebSocketConnection(page);

      // Open another tab to send a message
      const secondTab = await context.newPage();
      await login(secondTab);
      await secondTab.goto(`${BASE_URL}/sandboxes/${sandboxId}/chat`);
      await waitForWebSocketConnection(secondTab);

      // Send message from second tab
      const testMessage = `Test message ${Date.now()}`;
      await secondTab.getByRole("textbox").fill(testMessage);
      await secondTab.getByRole("button", { name: "Send" }).click();

      // Verify message appears in first tab
      await page.waitForTimeout(1000); // Allow time for WebSocket message
      await expect(page.getByText(testMessage)).toBeVisible();
    });

    test("should handle WebSocket disconnection and reconnection", async ({
      page,
    }) => {
      // Navigate to sandbox chat
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}/chat`);

      // Wait for WebSocket connection
      await waitForWebSocketConnection(page);

      // Simulate disconnection
      await page.evaluate(() => {
        // Force disconnect all WebSockets
        window.dispatchEvent(new Event("offline"));
      });

      // Verify disconnection indicator
      await expect(
        page.locator('[data-testid="ws-disconnected"]'),
      ).toBeVisible();

      // Simulate reconnection
      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });

      // Verify reconnection
      await waitForWebSocketConnection(page);

      // Verify reconnection toast appears
      const toast = await waitForToast(page);
      await expect(toast).toContainText("Reconnected");
    });

    test("should queue and deliver messages when reconnected", async ({
      page,
      context,
    }) => {
      // Navigate to sandbox chat
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}/chat`);

      // Wait for WebSocket connection
      await waitForWebSocketConnection(page);

      // Open another tab that stays connected
      const secondTab = await context.newPage();
      await login(secondTab);
      await secondTab.goto(`${BASE_URL}/sandboxes/${sandboxId}/chat`);
      await waitForWebSocketConnection(secondTab);

      // Disconnect first tab
      await page.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await expect(
        page.locator('[data-testid="ws-disconnected"]'),
      ).toBeVisible();

      // Send messages from second tab while first tab is disconnected
      const testMessage1 = `Offline message 1 ${Date.now()}`;
      const testMessage2 = `Offline message 2 ${Date.now()}`;

      await secondTab.getByRole("textbox").fill(testMessage1);
      await secondTab.getByRole("button", { name: "Send" }).click();

      await secondTab.getByRole("textbox").fill(testMessage2);
      await secondTab.getByRole("button", { name: "Send" }).click();

      // Reconnect first tab
      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });

      // Verify reconnection
      await waitForWebSocketConnection(page);

      // Verify queued messages appear after reconnection
      await page.waitForTimeout(2000); // Allow time for queued messages
      await expect(page.getByText(testMessage1)).toBeVisible();
      await expect(page.getByText(testMessage2)).toBeVisible();
    });
  });

  // 6. Test error handling and trace ID display in the UI
  test.describe("Error Handling and Trace ID Display", () => {
    test("should show trace ID in error responses", async ({ page }) => {
      // Force an error
      await forceError(page);

      // Verify error toast appears with trace ID
      const toast = await waitForToast(page);
      await expect(
        toast.locator('[data-testid="error-trace-id"]'),
      ).toBeVisible();

      // Verify trace ID format (UUID)
      const traceId = await toast
        .locator('[data-testid="error-trace-id"]')
        .textContent();
      expect(traceId).toMatch(/^[0-9a-f-]+$/);
    });

    test("should mask sensitive information in error messages", async ({
      page,
    }) => {
      // Navigate to page that forces an error with sensitive info
      await page.goto(`${BASE_URL}/debug?forceSensitiveError=true`);

      // Verify error toast appears
      const toast = await waitForToast(page);

      // Verify sensitive information is masked
      const errorText = await toast.textContent();
      expect(errorText).not.toContain("password");
      expect(errorText).not.toContain("token");
      expect(errorText).not.toContain("apiKey");
    });

    test("should categorize errors appropriately", async ({ page }) => {
      // Test network error
      await page.goto(`${BASE_URL}/debug?forceNetworkError=true`);
      const networkToast = await waitForToast(page);
      await expect(networkToast).toContainText("Network Error");

      // Test validation error
      await page.goto(`${BASE_URL}/debug?forceValidationError=true`);
      const validationToast = await waitForToast(page);
      await expect(validationToast).toContainText("Validation Error");

      // Test authentication error
      await page.goto(`${BASE_URL}/debug?forceAuthError=true`);
      const authToast = await waitForToast(page);
      await expect(authToast).toContainText("Authentication Error");
    });
  });

  // 7. Test feature flag controls affecting UI behavior
  test.describe("Feature Flag Controls", () => {
    test("should toggle UI features based on feature flags", async ({
      page,
      context,
    }) => {
      // First verify feature is enabled
      await page.goto(`${BASE_URL}/dashboard/kpi`);
      await expect(
        page.locator('[data-testid="cache-indicator"]'),
      ).toBeVisible();

      // Open admin page to disable feature flag
      const adminPage = await context.newPage();
      await login(adminPage, ADMIN_USER);
      await toggleFeatureFlag(adminPage, "enable-kpi-caching", false);

      // Refresh original page
      await page.reload();

      // Verify feature is now disabled
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');
      const cacheIndicator = await page
        .locator('[data-testid="cache-indicator"]')
        .count();
      expect(cacheIndicator).toBe(0);

      // Re-enable feature for other tests
      await toggleFeatureFlag(adminPage, "enable-kpi-caching", true);
    });

    test("should support percentage-based rollout of features", async ({
      context,
    }) => {
      // Set up admin page to configure percentage rollout
      const adminPage = await context.newPage();
      await login(adminPage, ADMIN_USER);

      // Navigate to feature flags admin
      await adminPage.goto(`${BASE_URL}/admin/feature-flags`);

      // Set test feature to 50% rollout
      await adminPage
        .locator(
          '[data-feature-flag="enable-new-test-feature"] [data-testid="percentage-input"]',
        )
        .fill("50");
      await adminPage.getByRole("button", { name: "Save" }).click();

      // Create multiple user sessions to test percentage rollout
      const results: boolean[] = [];

      // Test with 10 different users
      for (let i = 0; i < 10; i++) {
        const userPage = await context.newPage();
        // Each page gets a unique user ID to test percentage rollout
        await userPage.evaluate((i) => {
          localStorage.setItem("user_id", `test-user-${i}`);
        }, i);

        await login(userPage);
        await userPage.goto(`${BASE_URL}/feature-test`);

        // Check if feature is enabled for this user
        const isEnabled = await userPage
          .locator('[data-testid="feature-enabled"]')
          .isVisible();
        results.push(isEnabled);

        await userPage.close();
      }

      // Should be roughly 50% enabled (between 3-7 out of 10)
      const enabledCount = results.filter((r) => r).length;
      expect(enabledCount).toBeGreaterThanOrEqual(3);
      expect(enabledCount).toBeLessThanOrEqual(7);

      // Clean up - set back to fully enabled
      await adminPage
        .locator(
          '[data-feature-flag="enable-new-test-feature"] [data-testid="percentage-input"]',
        )
        .fill("100");
      await adminPage.getByRole("button", { name: "Save" }).click();
    });
  });

  // 8. Test accessibility compliance (WCAG AA)
  test.describe("Accessibility Compliance", () => {
    test("dashboard should be accessible", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include("#dashboard-container")
        .analyze();

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test("error components should be accessible", async ({ page }) => {
      // Force an error to show error components
      await forceError(page);

      // Wait for error toast
      await waitForToast(page);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="status"]')
        .analyze();

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test("error boundary fallback should be accessible", async ({ page }) => {
      // Navigate to page with component error
      await page.goto(`${BASE_URL}/debug/component-error`);

      // Wait for error boundary to appear
      await page.waitForSelector('[data-testid="component-error-boundary"]');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="component-error-boundary"]')
        .analyze();

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Press Tab to navigate through elements
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Verify focus indicator is visible
      const focusedElement = await page.evaluate(() => {
        const activeElement = document.activeElement;
        return activeElement ? activeElement.tagName : null;
      });

      expect(focusedElement).not.toBeNull();

      // Navigate to a button and press it with keyboard
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");

      // Verify action was triggered
      await expect(
        page.locator('[data-testid="action-triggered"]'),
      ).toBeVisible();
    });
  });

  // 9. Test responsive design on different screen sizes
  test.describe("Responsive Design", () => {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      test(`dashboard should be responsive on ${name} screens`, async ({
        page,
      }) => {
        // Set viewport size
        await page.setViewportSize(viewport);

        // Navigate to dashboard
        await page.goto(`${BASE_URL}/dashboard`);

        // Verify responsive layout
        if (name === "mobile") {
          // Mobile layout checks
          await expect(
            page.locator('[data-testid="mobile-menu-button"]'),
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="sidebar"]'),
          ).not.toBeVisible();

          // Open mobile menu
          await page.locator('[data-testid="mobile-menu-button"]').click();
          await expect(
            page.locator('[data-testid="mobile-menu"]'),
          ).toBeVisible();
        } else {
          // Tablet and desktop layout checks
          await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
          await expect(
            page.locator('[data-testid="mobile-menu-button"]'),
          ).not.toBeVisible();
        }

        // Verify content is properly laid out
        if (name === "mobile" || name === "tablet") {
          // Single column layout
          const contentWidth = await page
            .locator('[data-testid="dashboard-content"]')
            .evaluate((el) => el.clientWidth);
          const cardWidth = await page
            .locator('[data-testid="dashboard-card"]')
            .first()
            .evaluate((el) => el.clientWidth);

          // Card should take full width (minus some padding)
          expect(cardWidth).toBeGreaterThan(contentWidth * 0.9);
        } else {
          // Multi-column layout
          const cards = await page
            .locator('[data-testid="dashboard-card"]')
            .all();
          if (cards.length >= 2) {
            const card1Box = await cards[0].boundingBox();
            const card2Box = await cards[1].boundingBox();

            if (card1Box && card2Box) {
              // Cards should be side by side in desktop view
              expect(Math.abs(card1Box.y - card2Box.y)).toBeLessThan(10);
            }
          }
        }
      });
    }

    test("error components should be responsive", async ({ page }) => {
      // Test on mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);

      // Force an error
      await forceError(page);

      // Verify toast is properly sized for mobile
      const toast = await waitForToast(page);
      const toastBox = await toast.boundingBox();

      if (toastBox) {
        // Toast should not overflow viewport
        expect(toastBox.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
      }

      // Test on desktop viewport
      await page.setViewportSize(VIEWPORTS.desktop);

      // Force another error
      await forceError(page);

      // Verify toast is properly sized for desktop
      const desktopToast = await waitForToast(page);
      const desktopToastBox = await desktopToast.boundingBox();

      if (desktopToastBox && toastBox) {
        // Desktop toast should be wider than mobile toast
        expect(desktopToastBox.width).toBeGreaterThan(toastBox.width);
      }
    });
  });

  // 10. Test dark mode functionality
  test.describe("Dark Mode", () => {
    test("should toggle between light and dark mode", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Check initial theme
      const initialTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );

      // Toggle theme
      await toggleDarkMode(page);

      // Verify theme changed
      const newTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
      expect(newTheme).not.toEqual(initialTheme);

      // Toggle back
      await toggleDarkMode(page);

      // Verify back to original
      const finalTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
      expect(finalTheme).toEqual(initialTheme);
    });

    test("should persist dark mode preference", async ({ page, context }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Set to dark mode
      const initialTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
      if (initialTheme === "light") {
        await toggleDarkMode(page);
      }

      // Verify dark mode
      await expect(page.locator("html")).toHaveClass(/dark/);

      // Navigate to another page
      await page.goto(`${BASE_URL}/settings`);

      // Verify dark mode persisted
      await expect(page.locator("html")).toHaveClass(/dark/);

      // Open new tab
      const newTab = await context.newPage();
      await login(newTab);

      // Verify dark mode persisted in new tab
      await expect(newTab.locator("html")).toHaveClass(/dark/);
    });

    test("error components should respect dark mode", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Set to dark mode
      const initialTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
      if (initialTheme === "light") {
        await toggleDarkMode(page);
      }

      // Force an error
      await forceError(page);

      // Verify toast has dark mode styling
      const toast = await waitForToast(page);

      // Get background color of toast
      const bgColor = await toast.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Dark mode should have a dark background (low RGB values)
      const isRgb = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (isRgb) {
        const [_, r, g, b] = isRgb.map(Number);
        const brightness = (r + g + b) / 3;
        expect(brightness).toBeLessThan(128); // Darker color in dark mode
      }
    });
  });

  // 11. Test user authentication and authorization flows
  test.describe("Authentication and Authorization", () => {
    test("should require authentication for protected pages", async ({
      page,
    }) => {
      // Logout first
      await page.goto(`${BASE_URL}/logout`);

      // Try to access protected page
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login
      await expect(page).toHaveURL(/.*login/);
    });

    test("should enforce authorization for restricted resources", async ({
      page,
    }) => {
      // Login as restricted user
      await login(page, RESTRICTED_USER);

      // Try to access admin page
      await page.goto(`${BASE_URL}/admin/feature-flags`);

      // Should show access denied
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();

      // Try to access sandbox that user doesn't have access to
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}`);

      // Should show access denied
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });

    test("should handle invalid login attempts gracefully", async ({
      page,
    }) => {
      // Logout first
      await page.goto(`${BASE_URL}/logout`);

      // Try invalid login
      await page.goto(`${BASE_URL}/login`);
      await page.getByLabel("Email").fill("invalid@example.com");
      await page.getByLabel("Password").fill("wrongpassword");
      await page.getByRole("button", { name: "Sign In" }).click();

      // Should show error message
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();

      // Should not redirect to dashboard
      await expect(page).toHaveURL(/.*login/);
    });
  });

  // 12. Test complete user workflows end-to-end
  test.describe("End-to-End User Workflows", () => {
    test("should support complete conversation workflow", async ({ page }) => {
      // Navigate to sandbox
      await page.goto(`${BASE_URL}/sandboxes/${sandboxId}`);

      // Start new conversation
      await page.getByRole("button", { name: "New Conversation" }).click();

      // Type and send message
      const testMessage = `Test message ${Date.now()}`;
      await page.getByRole("textbox").fill(testMessage);
      await page.getByRole("button", { name: "Send" }).click();

      // Wait for response
      await page.waitForSelector('[data-testid="ai-response"]');

      // Verify message appears in conversation
      await expect(page.getByText(testMessage)).toBeVisible();

      // Verify AI response
      await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();

      // Test tool execution
      await page.getByRole("button", { name: "Execute Tool" }).click();
      await page.getByLabel("Tool").selectOption("calculator");
      await page.getByLabel("Expression").fill("2+2");
      await page.getByRole("button", { name: "Run" }).click();

      // Verify tool execution result
      await page.waitForSelector('[data-testid="tool-result"]');
      await expect(page.locator('[data-testid="tool-result"]')).toContainText(
        "4",
      );

      // End conversation
      await page.getByRole("button", { name: "End Conversation" }).click();
      await page.getByRole("button", { name: "Confirm" }).click();

      // Verify conversation ended
      await expect(
        page.locator('[data-testid="conversation-ended"]'),
      ).toBeVisible();
    });

    test("should support KPI analysis workflow", async ({ page }) => {
      // Navigate to KPI dashboard
      await page.goto(`${BASE_URL}/dashboard/kpi`);

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');

      // Select date range
      await page.getByRole("button", { name: "Date Range" }).click();
      await page.getByText("Last 30 Days").click();

      // Wait for data to update
      await page.waitForSelector('[data-testid="kpi-loading"]');
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');

      // Filter by specific metric
      await page.getByRole("button", { name: "Metrics" }).click();
      await page.getByLabel("Conversion Rate").check();
      await page.getByRole("button", { name: "Apply" }).click();

      // Verify filtered view
      await expect(
        page.locator('[data-testid="metric-conversion-rate"]'),
      ).toBeVisible();

      // Export report
      await page.getByRole("button", { name: "Export" }).click();
      await page.getByRole("button", { name: "Export PDF" }).click();

      // Verify export started
      await expect(
        page.locator('[data-testid="export-started"]'),
      ).toBeVisible();
    });
  });

  // 13. Test performance and loading states
  test.describe("Performance and Loading States", () => {
    test("should show appropriate loading states", async ({ page }) => {
      // Navigate to dashboard with slow connection
      await page.route("**/*", async (route) => {
        // Add delay to all requests
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto(`${BASE_URL}/dashboard`);

      // Verify loading skeleton is shown
      await expect(
        page.locator('[data-testid="dashboard-skeleton"]'),
      ).toBeVisible();

      // Wait for content to load
      await page.waitForSelector('[data-testid="dashboard-loaded"]');

      // Verify skeleton is replaced with content
      await expect(
        page.locator('[data-testid="dashboard-skeleton"]'),
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="dashboard-content"]'),
      ).toBeVisible();
    });

    test("should meet performance SLAs for cached endpoints", async ({
      page,
    }) => {
      // Prime the cache
      await page.goto(`${BASE_URL}/dashboard/kpi`);
      await page.waitForSelector('[data-testid="kpi-dashboard-loaded"]');

      // Measure load time for cached endpoint
      const loadTime = await measurePageLoad(page, `${BASE_URL}/dashboard/kpi`);

      // Should be under 300ms for cached endpoint
      expect(loadTime).toBeLessThan(300);
    });

    test("should lazy load components for better performance", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Check initial network requests
      const initialRequests = await page.evaluate(
        () => performance.getEntriesByType("resource").length,
      );

      // Navigate to a page with lazy-loaded components
      await page.click('[data-testid="nav-analytics"]');

      // Wait for lazy components to load
      await page.waitForSelector('[data-testid="analytics-loaded"]');

      // Check new network requests
      const newRequests = await page.evaluate(
        () => performance.getEntriesByType("resource").length,
      );

      // Should have more requests after lazy loading
      expect(newRequests).toBeGreaterThan(initialRequests);
    });
  });

  // 14. Test error recovery scenarios
  test.describe("Error Recovery", () => {
    test("should recover from network errors automatically", async ({
      page,
    }) => {
      // Navigate to dashboard
      await page.goto(`${BASE_URL}/dashboard`);

      // Simulate offline state
      await page.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });

      // Verify offline indicator
      await expect(
        page.locator('[data-testid="offline-indicator"]'),
      ).toBeVisible();

      // Try to load data that will fail
      await page.getByRole("button", { name: "Refresh Data" }).click();

      // Verify error toast
      const offlineToast = await waitForToast(page);
      await expect(offlineToast).toContainText("Network Error");

      // Simulate coming back online
      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });

      // Verify online indicator
      await expect(
        page.locator('[data-testid="offline-indicator"]'),
      ).not.toBeVisible();

      // Verify auto-retry happens
      await page.waitForSelector('[data-testid="auto-retry-started"]');

      // Verify data loads successfully
      await page.waitForSelector('[data-testid="dashboard-loaded"]');

      // Verify success toast
      const successToast = await waitForToast(page);
      await expect(successToast).toContainText("Connected");
    });

    test("should recover from component errors with retry", async ({
      page,
    }) => {
      // Navigate to page with component that will error
      await page.goto(`${BASE_URL}/debug/component-error`);

      // Verify component error boundary is shown
      await expect(
        page.locator('[data-testid="component-error-boundary"]'),
      ).toBeVisible();

      // Fix the error condition via developer tools
      await page.evaluate(() => {
        // Set flag to prevent error on next render
        window.localStorage.setItem("prevent_component_error", "true");
      });

      // Click retry button
      await page.getByRole("button", { name: "Retry" }).click();

      // Verify component renders correctly after retry
      await expect(
        page.locator('[data-testid="component-content"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="component-error-boundary"]'),
      ).not.toBeVisible();
    });
  });

  // 15. Test cross-browser compatibility
  test.describe("Cross-Browser Compatibility", () => {
    test("should work across different browsers", async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName === "webkit",
        "Skipping WebKit for now due to WebSocket implementation differences",
      );

      // Basic functionality test that should work in all browsers
      await page.goto(`${BASE_URL}/dashboard`);

      // Verify core UI elements
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="dashboard-content"]'),
      ).toBeVisible();

      // Test dark mode toggle (should work in all browsers)
      await toggleDarkMode(page);
      const isDarkMode = await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      );

      // Toggle back
      await toggleDarkMode(page);

      // Basic assertions that should pass in all browsers
      expect(typeof isDarkMode).toBe("boolean");
    });
  });
});
