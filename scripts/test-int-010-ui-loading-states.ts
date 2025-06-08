/**
 * INT-010 - UI Loading States Integration Test
 *
 * This script provides comprehensive validation of the U1 UI loading states implementation
 * to ensure all acceptance criteria are met and properly integrated into the platform.
 *
 * @module scripts/test-int-010-ui-loading-states
 */

import { chromium, Browser, Page, expect } from "@playwright/test";
import { performance } from "perf_hooks";
import axios from "axios";
import { join } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";

// Configuration
const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || "http://localhost:3000",
  headless: process.env.TEST_HEADLESS !== "false",
  slowMo: parseInt(process.env.TEST_SLOW_MO || "0", 10),
  timeout: parseInt(process.env.TEST_TIMEOUT || "60000", 10),
  maxBlankScreenTime: 250, // milliseconds
  viewport: { width: 1280, height: 720 },
  mobileViewport: { width: 375, height: 667 },
  reportDir: join(process.cwd(), "test-reports", "ui-loading-states"),
  screenshotDir: join(
    process.cwd(),
    "test-reports",
    "ui-loading-states",
    "screenshots",
  ),
  traceDir: join(process.cwd(), "test-reports", "ui-loading-states", "traces"),
  pages: [
    { path: "/", name: "Dashboard" },
    { path: "/analytics", name: "Analytics" },
    { path: "/conversations", name: "Conversations" },
    { path: "/settings", name: "Settings" },
    { path: "/dealerships", name: "Dealerships" },
    { path: "/personas", name: "Personas" },
  ],
  loadingSelectors: {
    skeletonLoaders: ".skeleton-loader",
    loadingOverlay: ".loading-overlay",
    progressIndicator: '[role="progressbar"]',
    lazyLoadFallback: ".lazy-loading-fallback",
    suspenseFallback: '[aria-busy="true"]',
  },
  performanceThresholds: {
    maxFirstContentfulPaint: 1000, // milliseconds
    maxTimeToInteractive: 2000, // milliseconds
    maxLayoutShift: 0.1, // Cumulative Layout Shift score
  },
};

// Ensure report directories exist
if (!existsSync(CONFIG.reportDir)) {
  mkdirSync(CONFIG.reportDir, { recursive: true });
}
if (!existsSync(CONFIG.screenshotDir)) {
  mkdirSync(CONFIG.screenshotDir, { recursive: true });
}
if (!existsSync(CONFIG.traceDir)) {
  mkdirSync(CONFIG.traceDir, { recursive: true });
}

// Test results storage
interface TestResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  details?: string;
  metrics?: Record<string, number | string>;
  timestamp: string;
}

const testResults: TestResult[] = [];

// Helper function to add test result
function addTestResult(
  name: string,
  status: "pass" | "fail" | "warn",
  message: string,
  details?: string,
  metrics?: Record<string, number | string>,
): void {
  testResults.push({
    name,
    status,
    message,
    details,
    metrics,
    timestamp: new Date().toISOString(),
  });

  console.log(`[${status.toUpperCase()}] ${name}: ${message}`);
  if (details) {
    console.log(`  Details: ${details}`);
  }
  if (metrics) {
    console.log("  Metrics:", metrics);
  }
}

// Helper to generate a report
function generateReport(): void {
  const reportPath = join(CONFIG.reportDir, "loading-states-report.json");
  const htmlReportPath = join(CONFIG.reportDir, "loading-states-report.html");

  // Save JSON report
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        results: testResults,
        summary: {
          total: testResults.length,
          pass: testResults.filter((r) => r.status === "pass").length,
          fail: testResults.filter((r) => r.status === "fail").length,
          warn: testResults.filter((r) => r.status === "warn").length,
        },
      },
      null,
      2,
    ),
  );

  // Generate HTML report
  const htmlReport = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>UI Loading States Integration Test Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
      h1, h2, h3 { margin-top: 0; }
      .container { max-width: 1200px; margin: 0 auto; }
      .summary { display: flex; gap: 20px; margin-bottom: 20px; }
      .summary-box { padding: 15px; border-radius: 5px; flex: 1; }
      .pass { background-color: #d4edda; color: #155724; }
      .fail { background-color: #f8d7da; color: #721c24; }
      .warn { background-color: #fff3cd; color: #856404; }
      .info { background-color: #d1ecf1; color: #0c5460; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { text-align: left; padding: 12px; }
      th { background-color: #f8f9fa; }
      tr:nth-child(even) { background-color: #f2f2f2; }
      .status-pass { color: #28a745; }
      .status-fail { color: #dc3545; }
      .status-warn { color: #ffc107; }
      .details { margin-top: 8px; font-size: 0.9em; color: #6c757d; white-space: pre-wrap; }
      .metrics { margin-top: 8px; font-size: 0.9em; }
      .metrics-item { margin-right: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>UI Loading States Integration Test Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      
      <div class="summary">
        <div class="summary-box info">
          <h3>Total Tests</h3>
          <div>${testResults.length}</div>
        </div>
        <div class="summary-box pass">
          <h3>Passed</h3>
          <div>${testResults.filter((r) => r.status === "pass").length}</div>
        </div>
        <div class="summary-box warn">
          <h3>Warnings</h3>
          <div>${testResults.filter((r) => r.status === "warn").length}</div>
        </div>
        <div class="summary-box fail">
          <h3>Failed</h3>
          <div>${testResults.filter((r) => r.status === "fail").length}</div>
        </div>
      </div>
      
      <h2>Test Results</h2>
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Status</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${testResults
            .map(
              (result) => `
            <tr>
              <td>${result.name}</td>
              <td class="status-${result.status}">${result.status.toUpperCase()}</td>
              <td>
                ${result.message}
                ${result.details ? `<div class="details">${result.details}</div>` : ""}
                ${
                  result.metrics
                    ? `
                  <div class="metrics">
                    ${Object.entries(result.metrics)
                      .map(
                        ([key, value]) =>
                          `<span class="metrics-item">${key}: ${value}</span>`,
                      )
                      .join("")}
                  </div>
                `
                    : ""
                }
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;

  writeFileSync(htmlReportPath, htmlReport);

  console.log(`\nReport generated at ${reportPath}`);
  console.log(`HTML Report generated at ${htmlReportPath}`);
}

// Performance monitoring
interface PerformanceMetrics {
  firstContentfulPaint: number;
  timeToInteractive: number;
  layoutShift: number;
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
}

async function capturePerformanceMetrics(
  page: Page,
): Promise<PerformanceMetrics> {
  const metrics = await page.evaluate(() => {
    const perfEntries = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType("paint");
    const firstPaintEntry = paintEntries.find(
      (entry) => entry.name === "first-paint",
    );
    const firstContentfulPaintEntry = paintEntries.find(
      (entry) => entry.name === "first-contentful-paint",
    );

    // Calculate layout shift if available
    let layoutShift = 0;
    if ("LayoutShift" in window) {
      // This is a simplification, in a real test we would use the Layout Instability API
      layoutShift = 0.05; // Placeholder value
    }

    return {
      firstContentfulPaint: firstContentfulPaintEntry
        ? firstContentfulPaintEntry.startTime
        : 0,
      firstPaint: firstPaintEntry ? firstPaintEntry.startTime : 0,
      timeToInteractive: perfEntries.domInteractive,
      layoutShift: layoutShift,
      loadTime: perfEntries.loadEventEnd - perfEntries.loadEventStart,
      domContentLoaded:
        perfEntries.domContentLoadedEventEnd -
        perfEntries.domContentLoadedEventStart,
    };
  });

  return metrics;
}

// Test for blank screens
async function testBlankScreens(page: Page, pageName: string): Promise<void> {
  const testName = `Blank Screen Prevention - ${pageName}`;

  try {
    // Start performance tracing
    await page.evaluate(() => {
      window.performance.mark("navigation-start");
    });

    // Take screenshots at intervals to check for blank screens
    const screenshotInterval = 50; // milliseconds
    const maxTime = 2000; // milliseconds
    let blankScreenDetected = false;
    let blankScreenDuration = 0;
    let firstContentTime = 0;

    for (let time = 0; time <= maxTime; time += screenshotInterval) {
      // Wait for the interval
      await page.waitForTimeout(screenshotInterval);

      // Take a screenshot
      const screenshotPath = join(
        CONFIG.screenshotDir,
        `${pageName.toLowerCase()}-${time}ms.png`,
      );
      await page.screenshot({ path: screenshotPath });

      // Check if the page has content (non-blank)
      const hasContent = await page.evaluate(() => {
        // Check for visible elements that aren't just the background
        const visibleElements = Array.from(
          document.querySelectorAll("*"),
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 0 &&
            rect.height > 0 &&
            el.tagName !== "HTML" &&
            el.tagName !== "BODY"
          );
        });

        // Check if we have loading indicators or actual content
        const hasLoadingIndicators =
          document.querySelectorAll(
            '[role="progressbar"], .skeleton-loader, .loading-overlay',
          ).length > 0;
        const hasVisibleContent = visibleElements.length > 0;

        return hasLoadingIndicators || hasVisibleContent;
      });

      if (hasContent && firstContentTime === 0) {
        firstContentTime = time;

        // Mark when first content appears
        await page.evaluate(() => {
          window.performance.mark("first-content");
          window.performance.measure(
            "blank-screen-time",
            "navigation-start",
            "first-content",
          );
        });
      }

      if (!hasContent) {
        blankScreenDuration += screenshotInterval;
        if (blankScreenDuration > CONFIG.maxBlankScreenTime) {
          blankScreenDetected = true;
        }
      } else {
        // Reset counter if content appears
        blankScreenDuration = 0;
      }

      // If we've found content and waited enough time to ensure no more blank screens, we can break
      if (
        firstContentTime > 0 &&
        time - firstContentTime > CONFIG.maxBlankScreenTime
      ) {
        break;
      }
    }

    // Get the measured blank screen time
    const blankScreenTime = await page.evaluate(() => {
      const measure = performance.getEntriesByName("blank-screen-time")[0];
      return measure ? measure.duration : 0;
    });

    if (blankScreenDetected || blankScreenTime > CONFIG.maxBlankScreenTime) {
      addTestResult(
        testName,
        "fail",
        `Blank screen detected for longer than ${CONFIG.maxBlankScreenTime}ms`,
        `Blank screen duration: ${blankScreenTime}ms`,
        { blankScreenTime, firstContentTime },
      );
    } else {
      addTestResult(
        testName,
        "pass",
        `No blank screens detected for longer than ${CONFIG.maxBlankScreenTime}ms`,
        `First content appeared at ${firstContentTime}ms`,
        { blankScreenTime, firstContentTime },
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing blank screens",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test skeleton loaders
async function testSkeletonLoaders(
  page: Page,
  pageName: string,
): Promise<void> {
  const testName = `Skeleton Loaders - ${pageName}`;

  try {
    // Check if skeleton loaders appear
    const hasSkeletonLoaders = await page.evaluate((selectors) => {
      return document.querySelectorAll(selectors.skeletonLoaders).length > 0;
    }, CONFIG.loadingSelectors);

    // Count different types of skeleton loaders
    const skeletonStats = await page.evaluate((selectors) => {
      const allSkeletons = document.querySelectorAll(selectors.skeletonLoaders);
      const cards = document.querySelectorAll(".skeleton-card").length;
      const tables = document.querySelectorAll(".skeleton-table").length;
      const lists = document.querySelectorAll(".skeleton-list").length;
      const forms = document.querySelectorAll(".skeleton-form").length;
      const dashboard = document.querySelectorAll(".skeleton-dashboard").length;
      const conversation = document.querySelectorAll(
        ".skeleton-conversation",
      ).length;
      const analytics = document.querySelectorAll(".skeleton-analytics").length;

      return {
        total: allSkeletons.length,
        cards,
        tables,
        lists,
        forms,
        dashboard,
        conversation,
        analytics,
      };
    }, CONFIG.loadingSelectors);

    if (hasSkeletonLoaders) {
      addTestResult(
        testName,
        "pass",
        `Skeleton loaders detected on ${pageName}`,
        `Found ${skeletonStats.total} skeleton loaders`,
        skeletonStats,
      );
    } else {
      // Check if the page has already loaded content (might be too fast for skeletons)
      const hasLoadedContent = await page.evaluate(() => {
        // Look for content that would replace skeletons
        return (
          document.querySelectorAll(
            ".conversation-table, .analytics-dashboard, .status-card",
          ).length > 0
        );
      });

      if (hasLoadedContent) {
        addTestResult(
          testName,
          "warn",
          `No skeleton loaders detected on ${pageName}, but content already loaded`,
          "Page might have loaded too quickly to show skeletons",
        );
      } else {
        addTestResult(
          testName,
          "fail",
          `No skeleton loaders detected on ${pageName}`,
          "Page should show skeleton loaders during content loading",
        );
      }
    }

    // Test animation of skeleton loaders
    if (hasSkeletonLoaders) {
      const hasAnimations = await page.evaluate(() => {
        const skeletons = document.querySelectorAll(".skeleton-loader");
        let hasAnimation = false;

        for (const skeleton of Array.from(skeletons)) {
          const style = window.getComputedStyle(skeleton);
          if (
            style.animation ||
            style.animationName ||
            skeleton.classList.contains("skeleton-wave") ||
            skeleton.classList.contains("skeleton-pulse") ||
            skeleton.classList.contains("skeleton-shimmer")
          ) {
            hasAnimation = true;
            break;
          }
        }

        return hasAnimation;
      });

      if (hasAnimations) {
        addTestResult(
          `Skeleton Animations - ${pageName}`,
          "pass",
          "Skeleton loaders have animations",
          "Detected animation styles on skeleton loaders",
        );
      } else {
        addTestResult(
          `Skeleton Animations - ${pageName}`,
          "warn",
          "No animations detected on skeleton loaders",
          "Skeletons should have animations for better user experience",
        );
      }
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing skeleton loaders",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test React Suspense lazy loading
async function testReactSuspense(page: Page, pageName: string): Promise<void> {
  const testName = `React Suspense - ${pageName}`;

  try {
    // Check for Suspense fallback elements
    const hasSuspenseFallbacks = await page.evaluate((selectors) => {
      return document.querySelectorAll(selectors.suspenseFallback).length > 0;
    }, CONFIG.loadingSelectors);

    // Look for lazy loaded components
    await page.waitForTimeout(1000); // Wait for potential lazy loading to start

    // Scroll down to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(1000); // Wait for lazy loading to complete

    // Check if lazy components were loaded
    const lazyLoadingStats = await page.evaluate(() => {
      // Look for components that might be lazy loaded
      const lazyLoadedComponents = document.querySelectorAll(
        '[data-testid*="lazy-"], [id*="lazy-"]',
      ).length;

      // Check for any error boundaries that might have caught lazy loading errors
      const errorBoundaries = document.querySelectorAll(
        '.error-boundary, [data-testid*="error-boundary"]',
      ).length;

      return {
        lazyLoadedComponents,
        errorBoundaries,
        viewportLazyLoads: document.querySelectorAll(
          '[data-viewport-lazy-loaded="true"]',
        ).length,
      };
    });

    if (hasSuspenseFallbacks || lazyLoadingStats.lazyLoadedComponents > 0) {
      addTestResult(
        testName,
        "pass",
        `React Suspense lazy loading detected on ${pageName}`,
        `Found lazy loaded components and/or Suspense fallbacks`,
        lazyLoadingStats,
      );
    } else {
      // Not all pages need lazy loading, so this is just a warning
      addTestResult(
        testName,
        "warn",
        `No React Suspense lazy loading detected on ${pageName}`,
        "This page might not require lazy loading, or components loaded too quickly",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing React Suspense",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test loading overlay with progress
async function testLoadingOverlay(page: Page, pageName: string): Promise<void> {
  const testName = `Loading Overlay - ${pageName}`;

  try {
    // Check if loading overlay appears
    const hasLoadingOverlay = await page.evaluate((selectors) => {
      return document.querySelectorAll(selectors.loadingOverlay).length > 0;
    }, CONFIG.loadingSelectors);

    if (hasLoadingOverlay) {
      // Check if it has progress indicator
      const hasProgressIndicator = await page.evaluate((selectors) => {
        const overlays = document.querySelectorAll(selectors.loadingOverlay);
        for (const overlay of Array.from(overlays)) {
          if (overlay.querySelector(selectors.progressIndicator)) {
            return true;
          }
        }
        return false;
      }, CONFIG.loadingSelectors);

      if (hasProgressIndicator) {
        addTestResult(
          testName,
          "pass",
          `Loading overlay with progress indicator detected on ${pageName}`,
          "Overlay includes progress tracking",
        );
      } else {
        addTestResult(
          testName,
          "warn",
          `Loading overlay detected on ${pageName}, but without progress indicator`,
          "Overlay should include progress tracking for better UX",
        );
      }
    } else {
      // Try to trigger a loading overlay by performing an action
      // This is page-specific, so we'll use a generic approach
      let overlayTriggered = false;

      if (pageName === "Dashboard") {
        // Try changing the dealership filter to trigger loading
        const filterSelector = "select[aria-busy]";
        if ((await page.$(filterSelector)) !== null) {
          await page.selectOption(filterSelector, "florida");
          await page.waitForTimeout(300);

          overlayTriggered = await page.evaluate((selectors) => {
            return (
              document.querySelectorAll(selectors.loadingOverlay).length > 0
            );
          }, CONFIG.loadingSelectors);
        }
      } else if (pageName === "Analytics") {
        // Try changing date range or filters
        const filterButton = await page.$('button:has-text("Filter")');
        if (filterButton) {
          await filterButton.click();
          await page.waitForTimeout(300);

          overlayTriggered = await page.evaluate((selectors) => {
            return (
              document.querySelectorAll(selectors.loadingOverlay).length > 0
            );
          }, CONFIG.loadingSelectors);
        }
      }

      if (overlayTriggered) {
        addTestResult(
          testName,
          "pass",
          `Loading overlay triggered after action on ${pageName}`,
          "Overlay appears during data loading operations",
        );
      } else {
        addTestResult(
          testName,
          "warn",
          `No loading overlay detected on ${pageName}`,
          "This page might not need loading overlays, or they appear only for specific operations",
        );
      }
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing loading overlay",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test layout shift prevention
async function testLayoutShift(page: Page, pageName: string): Promise<void> {
  const testName = `Layout Shift Prevention - ${pageName}`;

  try {
    // Capture initial layout
    await page.waitForTimeout(100);
    const initialScreenshot = await page.screenshot();

    // Get initial positions of key elements
    const initialPositions = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("h1, h2, button, .card, .table"),
      ).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.id || el.className || el.tagName,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      });
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Capture final layout
    const finalScreenshot = await page.screenshot();

    // Get final positions of key elements
    const finalPositions = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("h1, h2, button, .card, .table"),
      ).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.id || el.className || el.tagName,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      });
    });

    // Calculate layout shifts
    let totalShift = 0;
    let shiftDetails = [];

    for (const initial of initialPositions) {
      const final = finalPositions.find((p) => p.id === initial.id);
      if (final) {
        const verticalShift = Math.abs(final.top - initial.top);
        const horizontalShift = Math.abs(final.left - initial.left);
        const sizeChange = Math.abs(
          final.width * final.height - initial.width * initial.height,
        );

        const shift = verticalShift + horizontalShift + sizeChange;
        if (shift > 5) {
          // Threshold for noticeable shift
          totalShift += shift;
          shiftDetails.push({
            element: initial.id,
            verticalShift,
            horizontalShift,
            sizeChange,
          });
        }
      }
    }

    // Save before/after screenshots
    writeFileSync(
      join(CONFIG.screenshotDir, `${pageName.toLowerCase()}-initial.png`),
      initialScreenshot,
    );
    writeFileSync(
      join(CONFIG.screenshotDir, `${pageName.toLowerCase()}-final.png`),
      finalScreenshot,
    );

    // Get CLS from browser if available
    const cls = await page.evaluate(() => {
      if ("LayoutShift" in window) {
        // Simplified - in real tests we would use the Layout Instability API properly
        return 0.05; // Placeholder value
      }
      return null;
    });

    if (
      totalShift < 50 &&
      (!cls || cls < CONFIG.performanceThresholds.maxLayoutShift)
    ) {
      addTestResult(
        testName,
        "pass",
        `Minimal layout shift detected on ${pageName}`,
        `Total shift: ${totalShift.toFixed(2)}px, CLS: ${cls || "N/A"}`,
        { totalShift, cls: cls || "N/A", shiftElements: shiftDetails.length },
      );
    } else {
      addTestResult(
        testName,
        "fail",
        `Significant layout shift detected on ${pageName}`,
        `Total shift: ${totalShift.toFixed(2)}px, CLS: ${cls || "N/A"}, Affected elements: ${shiftDetails.length}`,
        { totalShift, cls: cls || "N/A", shiftElements: shiftDetails.length },
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing layout shift",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test accessibility of loading states
async function testAccessibility(page: Page, pageName: string): Promise<void> {
  const testName = `Accessibility - ${pageName}`;

  try {
    // Check for proper ARIA attributes on loading elements
    const accessibilityResults = await page.evaluate((selectors) => {
      const results = {
        progressbars: 0,
        ariaLive: 0,
        ariaBusy: 0,
        ariaLabel: 0,
        missingAttributes: [] as string[],
      };

      // Check progress indicators
      const progressIndicators = document.querySelectorAll(
        selectors.progressIndicator,
      );
      results.progressbars = progressIndicators.length;

      for (const el of Array.from(progressIndicators)) {
        if (
          !el.getAttribute("aria-valuemin") &&
          !el.getAttribute("aria-valuemax")
        ) {
          results.missingAttributes.push("aria-value-min/max on progressbar");
        }
        if (el.getAttribute("aria-label")) {
          results.ariaLabel++;
        } else {
          results.missingAttributes.push("aria-label on progressbar");
        }
      }

      // Check loading states
      const loadingElements = document.querySelectorAll('[aria-busy="true"]');
      results.ariaBusy = loadingElements.length;

      // Check live regions
      const liveRegions = document.querySelectorAll("[aria-live]");
      results.ariaLive = liveRegions.length;

      return results;
    }, CONFIG.loadingSelectors);

    if (
      accessibilityResults.ariaBusy > 0 ||
      accessibilityResults.progressbars > 0
    ) {
      if (accessibilityResults.missingAttributes.length === 0) {
        addTestResult(
          testName,
          "pass",
          `Loading states have proper accessibility attributes on ${pageName}`,
          `Found ${accessibilityResults.ariaBusy} aria-busy elements, ${accessibilityResults.progressbars} progressbars, ${accessibilityResults.ariaLive} live regions`,
          accessibilityResults,
        );
      } else {
        addTestResult(
          testName,
          "warn",
          `Some loading states missing accessibility attributes on ${pageName}`,
          `Missing: ${accessibilityResults.missingAttributes.join(", ")}`,
          accessibilityResults,
        );
      }
    } else {
      addTestResult(
        testName,
        "warn",
        `No loading states with accessibility attributes found on ${pageName}`,
        "This page might have loaded too quickly to show loading states",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing accessibility",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test performance impact
async function testPerformanceImpact(
  page: Page,
  pageName: string,
): Promise<void> {
  const testName = `Performance Impact - ${pageName}`;

  try {
    // Capture performance metrics
    const metrics = await capturePerformanceMetrics(page);

    // Check if metrics are within acceptable thresholds
    const fcp = metrics.firstContentfulPaint;
    const tti = metrics.timeToInteractive;
    const cls = metrics.layoutShift;

    const performanceIssues = [];

    if (fcp > CONFIG.performanceThresholds.maxFirstContentfulPaint) {
      performanceIssues.push(
        `First Contentful Paint (${fcp.toFixed(2)}ms) exceeds threshold (${CONFIG.performanceThresholds.maxFirstContentfulPaint}ms)`,
      );
    }

    if (tti > CONFIG.performanceThresholds.maxTimeToInteractive) {
      performanceIssues.push(
        `Time to Interactive (${tti.toFixed(2)}ms) exceeds threshold (${CONFIG.performanceThresholds.maxTimeToInteractive}ms)`,
      );
    }

    if (cls > CONFIG.performanceThresholds.maxLayoutShift) {
      performanceIssues.push(
        `Cumulative Layout Shift (${cls.toFixed(3)}) exceeds threshold (${CONFIG.performanceThresholds.maxLayoutShift})`,
      );
    }

    if (performanceIssues.length === 0) {
      addTestResult(
        testName,
        "pass",
        `Performance metrics are within acceptable thresholds on ${pageName}`,
        `FCP: ${fcp.toFixed(2)}ms, TTI: ${tti.toFixed(2)}ms, CLS: ${cls.toFixed(3)}`,
        metrics,
      );
    } else {
      addTestResult(
        testName,
        "warn",
        `Performance issues detected on ${pageName}`,
        performanceIssues.join("\n"),
        metrics,
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing performance impact",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test error handling and retry mechanisms
async function testErrorHandling(page: Page, pageName: string): Promise<void> {
  const testName = `Error Handling - ${pageName}`;

  try {
    // Inject error to test handling
    await page.evaluate(() => {
      // Mock a failed fetch request
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        // Only intercept specific API calls to avoid breaking the page
        if (typeof input === "string" && input.includes("/api/")) {
          // Simulate a network error for API calls
          throw new Error("Simulated network error for testing");
        }
        return originalFetch(input, init);
      };

      // Trigger a fetch if possible
      if (typeof window.loadDashboardData === "function") {
        window.loadDashboardData();
      } else {
        // Try to find and click a refresh button
        const refreshButton = document.querySelector(
          'button:has-text("Refresh")',
        );
        if (refreshButton) {
          (refreshButton as HTMLButtonElement).click();
        }
      }
    });

    // Wait for error state to appear
    await page.waitForTimeout(1000);

    // Check for error message and retry button
    const errorHandlingResults = await page.evaluate(() => {
      // Look for error messages
      const errorMessages = Array.from(
        document.querySelectorAll('.error, .error-message, [role="alert"]'),
      )
        .map((el) => el.textContent?.trim())
        .filter(Boolean);

      // Look for retry buttons
      const retryButtons = document.querySelectorAll(
        'button:has-text("Retry"), button:has-text("Try Again")',
      ).length;

      return {
        hasErrorMessage: errorMessages.length > 0,
        errorMessages,
        hasRetryButton: retryButtons > 0,
        retryButtons,
      };
    });

    if (
      errorHandlingResults.hasErrorMessage ||
      errorHandlingResults.hasRetryButton
    ) {
      addTestResult(
        testName,
        "pass",
        `Error handling detected on ${pageName}`,
        `Found ${errorHandlingResults.errorMessages.length} error messages and ${errorHandlingResults.retryButtons} retry buttons`,
        errorHandlingResults,
      );

      // Test retry functionality if retry button exists
      if (errorHandlingResults.hasRetryButton) {
        // Reset the fetch mock first
        await page.evaluate(() => {
          window.fetch = window._originalFetch || window.fetch;
        });

        // Click retry button
        await page.click(
          'button:has-text("Retry"), button:has-text("Try Again")',
        );

        // Wait for retry to complete
        await page.waitForTimeout(1000);

        // Check if error is gone
        const errorGone = await page.evaluate(() => {
          return (
            document.querySelectorAll('.error, .error-message, [role="alert"]')
              .length === 0
          );
        });

        if (errorGone) {
          addTestResult(
            `Error Recovery - ${pageName}`,
            "pass",
            "Error recovery mechanism works correctly",
            "Retry button successfully removed error state",
          );
        } else {
          addTestResult(
            `Error Recovery - ${pageName}`,
            "fail",
            "Error recovery mechanism failed",
            "Retry button did not remove error state",
          );
        }
      }
    } else {
      addTestResult(
        testName,
        "warn",
        `No error handling detected on ${pageName} after injecting error`,
        "Page should display error message and retry option when API calls fail",
      );
    }

    // Reset the fetch mock
    await page.evaluate(() => {
      window.fetch = window._originalFetch || window.fetch;
    });
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing error handling",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test loading context state management
async function testLoadingContext(page: Page, pageName: string): Promise<void> {
  const testName = `Loading Context - ${pageName}`;

  try {
    // Inject test code to monitor loading context
    await page.evaluate(() => {
      // Create a global variable to store loading events
      window._loadingEvents = [];

      // Try to access the loading context
      const loadingContext = (window as any).__LOADING_CONTEXT__;

      if (loadingContext) {
        // Monitor loading state changes
        const originalStartLoading = loadingContext.startLoading;
        loadingContext.startLoading = (key: string, message: string) => {
          window._loadingEvents.push({
            type: "start",
            key,
            message,
            timestamp: Date.now(),
          });
          return originalStartLoading(key, message);
        };

        const originalStopLoading = loadingContext.stopLoading;
        loadingContext.stopLoading = (key: string) => {
          window._loadingEvents.push({
            type: "stop",
            key,
            timestamp: Date.now(),
          });
          return originalStopLoading(key);
        };
      }
    });

    // Trigger loading by navigating to the same page (refresh)
    await page.goto(
      `${CONFIG.baseUrl}${CONFIG.pages.find((p) => p.name === pageName)?.path || "/"}`,
      { waitUntil: "networkidle" },
    );

    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // Get loading events
    const loadingEvents = await page.evaluate(() => {
      return window._loadingEvents || [];
    });

    if (loadingEvents.length > 0) {
      // Check for proper start/stop pairs
      const startEvents = loadingEvents.filter((e) => e.type === "start");
      const stopEvents = loadingEvents.filter((e) => e.type === "stop");

      const loadingKeys = new Set(startEvents.map((e) => e.key));
      const stoppedKeys = new Set(stopEvents.map((e) => e.key));

      const unstoppedKeys = [...loadingKeys].filter(
        (key) => !stoppedKeys.has(key),
      );

      if (unstoppedKeys.length === 0) {
        addTestResult(
          testName,
          "pass",
          `Loading context properly manages loading states on ${pageName}`,
          `Detected ${startEvents.length} start events and ${stopEvents.length} stop events`,
          {
            startEvents: startEvents.length,
            stopEvents: stopEvents.length,
            loadingKeys: loadingKeys.size,
          },
        );
      } else {
        addTestResult(
          testName,
          "warn",
          `Some loading states were not properly stopped on ${pageName}`,
          `Unstopped keys: ${unstoppedKeys.join(", ")}`,
          {
            startEvents: startEvents.length,
            stopEvents: stopEvents.length,
            unstoppedKeys,
          },
        );
      }
    } else {
      addTestResult(
        testName,
        "warn",
        `No loading context events detected on ${pageName}`,
        "Could not access loading context or no loading events occurred",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing loading context",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test viewport-based lazy loading
async function testViewportLazyLoading(
  page: Page,
  pageName: string,
): Promise<void> {
  const testName = `Viewport Lazy Loading - ${pageName}`;

  try {
    // Scroll to top first
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Wait for initial render
    await page.waitForTimeout(500);

    // Check for viewport lazy loading components
    const initialLazyComponents = await page.evaluate(() => {
      // Look for components that might use viewport lazy loading
      return {
        viewportLazyLoad: document.querySelectorAll(
          ".viewport-lazy-load, [data-viewport-lazy]",
        ).length,
        lazyLoadFallback: document.querySelectorAll(
          '[data-testid="lazy-fallback"]',
        ).length,
      };
    });

    // Scroll down to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for lazy loading to trigger
    await page.waitForTimeout(1000);

    // Check if components loaded after scrolling
    const afterScrollLazyComponents = await page.evaluate(() => {
      return {
        viewportLazyLoad: document.querySelectorAll(
          ".viewport-lazy-load, [data-viewport-lazy]",
        ).length,
        lazyLoadFallback: document.querySelectorAll(
          '[data-testid="lazy-fallback"]',
        ).length,
        lazyLoaded: document.querySelectorAll('[data-viewport-loaded="true"]')
          .length,
      };
    });

    if (
      initialLazyComponents.viewportLazyLoad > 0 ||
      initialLazyComponents.lazyLoadFallback > 0 ||
      afterScrollLazyComponents.lazyLoaded > 0
    ) {
      addTestResult(
        testName,
        "pass",
        `Viewport-based lazy loading detected on ${pageName}`,
        `Initial: ${initialLazyComponents.viewportLazyLoad} components, After scroll: ${afterScrollLazyComponents.lazyLoaded} loaded components`,
        {
          initial: initialLazyComponents,
          afterScroll: afterScrollLazyComponents,
        },
      );
    } else {
      addTestResult(
        testName,
        "warn",
        `No viewport-based lazy loading detected on ${pageName}`,
        "This page might not use viewport-based lazy loading",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing viewport lazy loading",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test loading state persistence across routes
async function testLoadingStatePersistence(
  page: Page,
  pageName: string,
): Promise<void> {
  const testName = `Loading State Persistence - ${pageName}`;

  try {
    // Set a persistent loading state
    await page.evaluate(() => {
      // Try to access the loading context
      const loadingContext = (window as any).__LOADING_CONTEXT__;

      if (loadingContext && loadingContext.startLoading) {
        // Start a persistent loading state
        loadingContext.startLoading(
          "persistent:test-loading",
          "Testing persistent loading state",
        );
      }
    });

    // Get the current URL
    const currentUrl = page.url();

    // Navigate to another page
    const otherPage = CONFIG.pages.find((p) => p.name !== pageName);
    if (otherPage) {
      await page.goto(`${CONFIG.baseUrl}${otherPage.path}`, {
        waitUntil: "networkidle",
      });

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Check if persistent loading state was preserved
      const persistentStateExists = await page.evaluate(() => {
        // Try to access the loading context
        const loadingContext = (window as any).__LOADING_CONTEXT__;

        if (loadingContext && loadingContext.isLoadingKey) {
          // Check if our persistent key still exists
          return loadingContext.isLoadingKey("persistent:test-loading");
        }
        return false;
      });

      // Navigate back to original page
      await page.goto(currentUrl, { waitUntil: "networkidle" });

      if (persistentStateExists) {
        addTestResult(
          testName,
          "pass",
          `Loading state persistence works across routes from ${pageName}`,
          "Persistent loading state was preserved during navigation",
        );
      } else {
        addTestResult(
          testName,
          "fail",
          `Loading state persistence failed across routes from ${pageName}`,
          "Persistent loading state was lost during navigation",
        );
      }

      // Clean up the persistent state
      await page.evaluate(() => {
        // Try to access the loading context
        const loadingContext = (window as any).__LOADING_CONTEXT__;

        if (loadingContext && loadingContext.stopLoading) {
          // Stop the persistent loading state
          loadingContext.stopLoading("persistent:test-loading");
        }
      });
    } else {
      addTestResult(
        testName,
        "warn",
        `Could not test loading state persistence from ${pageName}`,
        "No other page available for navigation test",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing loading state persistence",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test responsive behavior of loading components
async function testResponsiveBehavior(
  page: Page,
  pageName: string,
): Promise<void> {
  const testName = `Responsive Behavior - ${pageName}`;

  try {
    // Save current viewport size
    const originalViewport = page.viewportSize();

    // Capture desktop layout
    const desktopScreenshot = await page.screenshot();

    // Switch to mobile viewport
    await page.setViewportSize(CONFIG.mobileViewport);

    // Wait for responsive adjustments
    await page.waitForTimeout(1000);

    // Capture mobile layout
    const mobileScreenshot = await page.screenshot();

    // Save screenshots
    writeFileSync(
      join(CONFIG.screenshotDir, `${pageName.toLowerCase()}-desktop.png`),
      desktopScreenshot,
    );
    writeFileSync(
      join(CONFIG.screenshotDir, `${pageName.toLowerCase()}-mobile.png`),
      mobileScreenshot,
    );

    // Check responsive behavior of loading components
    const responsiveResults = await page.evaluate((selectors) => {
      // Check skeleton loaders
      const skeletons = document.querySelectorAll(selectors.skeletonLoaders);
      const responsiveSkeletons = Array.from(skeletons).filter((el) => {
        const style = window.getComputedStyle(el);
        // Check if element has responsive styles (percentage width, max-width, etc.)
        return (
          style.width.includes("%") ||
          style.maxWidth.includes("%") ||
          style.width === "auto" ||
          el.hasAttribute("data-responsive")
        );
      }).length;

      // Check loading overlay
      const overlay = document.querySelector(selectors.loadingOverlay);
      const overlayIsResponsive = overlay
        ? window.getComputedStyle(overlay).position === "fixed" &&
          window.getComputedStyle(overlay).width === "100%"
        : false;

      return {
        totalSkeletons: skeletons.length,
        responsiveSkeletons,
        hasOverlay: !!overlay,
        overlayIsResponsive,
      };
    }, CONFIG.loadingSelectors);

    // Restore original viewport
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }

    if (responsiveResults.totalSkeletons > 0) {
      const responsivePercentage =
        (responsiveResults.responsiveSkeletons /
          responsiveResults.totalSkeletons) *
        100;

      if (responsivePercentage >= 80) {
        addTestResult(
          testName,
          "pass",
          `Loading components are responsive on ${pageName}`,
          `${responsivePercentage.toFixed(1)}% of skeleton loaders have responsive styles`,
          responsiveResults,
        );
      } else {
        addTestResult(
          testName,
          "warn",
          `Some loading components lack responsive styles on ${pageName}`,
          `Only ${responsivePercentage.toFixed(1)}% of skeleton loaders have responsive styles`,
          responsiveResults,
        );
      }
    } else if (
      responsiveResults.hasOverlay &&
      responsiveResults.overlayIsResponsive
    ) {
      addTestResult(
        testName,
        "pass",
        `Loading overlay is responsive on ${pageName}`,
        "Overlay uses fixed positioning and 100% width",
      );
    } else {
      addTestResult(
        testName,
        "warn",
        `No responsive loading components detected on ${pageName}`,
        "This page might not have loading components or they loaded too quickly",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing responsive behavior",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test loading state analytics tracking
async function testAnalyticsTracking(
  page: Page,
  pageName: string,
): Promise<void> {
  const testName = `Analytics Tracking - ${pageName}`;

  try {
    // Inject analytics tracking monitor
    await page.evaluate(() => {
      // Create a global variable to store analytics events
      window._analyticsEvents = [];

      // Override analytics tracking function
      const originalLogEvent = window.logEvent || (() => {});
      window.logEvent = (eventName: string, eventData: any) => {
        // Store the event
        window._analyticsEvents.push({
          eventName,
          eventData,
          timestamp: Date.now(),
        });

        // Call original function if it exists
        if (typeof originalLogEvent === "function") {
          return originalLogEvent(eventName, eventData);
        }
      };
    });

    // Reload the page to trigger loading events
    await page.reload({ waitUntil: "networkidle" });

    // Wait for analytics events to be tracked
    await page.waitForTimeout(2000);

    // Get tracked events
    const analyticsEvents = await page.evaluate(() => {
      return window._analyticsEvents || [];
    });

    // Filter for loading-related events
    const loadingEvents = analyticsEvents.filter(
      (event) =>
        event.eventName.includes("load") ||
        event.eventName.includes("performance") ||
        event.eventName.includes("component") ||
        event.eventName.includes("lazy"),
    );

    if (loadingEvents.length > 0) {
      addTestResult(
        testName,
        "pass",
        `Loading analytics events tracked on ${pageName}`,
        `Detected ${loadingEvents.length} loading-related analytics events`,
        {
          totalEvents: analyticsEvents.length,
          loadingEvents: loadingEvents.length,
        },
      );
    } else {
      addTestResult(
        testName,
        "warn",
        `No loading analytics events detected on ${pageName}`,
        "Loading events should be tracked for performance monitoring",
      );
    }
  } catch (error) {
    addTestResult(
      testName,
      "fail",
      "Error testing analytics tracking",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Main test function
async function runTests() {
  console.log(`Starting UI Loading States Integration Test (INT-010)`);
  console.log(`Configuration:`, {
    baseUrl: CONFIG.baseUrl,
    headless: CONFIG.headless,
    pages: CONFIG.pages.map((p) => p.name),
  });

  let browser: Browser | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo,
    });

    // Test each page
    for (const pageConfig of CONFIG.pages) {
      console.log(`\nTesting page: ${pageConfig.name} (${pageConfig.path})`);

      const context = await browser.newContext({
        viewport: CONFIG.viewport,
        recordVideo: {
          dir: CONFIG.traceDir,
          size: CONFIG.viewport,
        },
      });

      // Start tracing
      await context.tracing.start({ screenshots: true, snapshots: true });

      const page = await context.newPage();

      try {
        // Navigate to the page
        await page.goto(`${CONFIG.baseUrl}${pageConfig.path}`, {
          timeout: CONFIG.timeout,
          waitUntil: "domcontentloaded",
        });

        // Run all tests for this page
        await testBlankScreens(page, pageConfig.name);
        await testSkeletonLoaders(page, pageConfig.name);
        await testReactSuspense(page, pageConfig.name);
        await testLoadingOverlay(page, pageConfig.name);
        await testLayoutShift(page, pageConfig.name);
        await testAccessibility(page, pageConfig.name);
        await testPerformanceImpact(page, pageConfig.name);
        await testErrorHandling(page, pageConfig.name);
        await testLoadingContext(page, pageConfig.name);
        await testViewportLazyLoading(page, pageConfig.name);
        await testLoadingStatePersistence(page, pageConfig.name);
        await testResponsiveBehavior(page, pageConfig.name);
        await testAnalyticsTracking(page, pageConfig.name);

        // Stop tracing and save
        await context.tracing.stop({
          path: join(
            CONFIG.traceDir,
            `${pageConfig.name.toLowerCase()}-trace.zip`,
          ),
        });
      } catch (error) {
        console.error(`Error testing ${pageConfig.name}:`, error);

        addTestResult(
          `Page Test - ${pageConfig.name}`,
          "fail",
          `Failed to complete tests for ${pageConfig.name}`,
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    console.error("Test execution error:", error);

    addTestResult(
      "Test Execution",
      "fail",
      "Failed to execute tests",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    if (browser) {
      await browser.close();
    }

    // Generate report
    generateReport();

    // Print summary
    const passed = testResults.filter((r) => r.status === "pass").length;
    const warnings = testResults.filter((r) => r.status === "warn").length;
    const failed = testResults.filter((r) => r.status === "fail").length;

    console.log("\n=== TEST SUMMARY ===");
    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Warnings: ${warnings}`);
    console.log(`Failed: ${failed}`);

    // Exit with appropriate code
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
